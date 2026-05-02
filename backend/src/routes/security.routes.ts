/**
 * MesaSmart · Loss Prevention · Routes
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { analyzeFrame } from "../services/security.service.js";

export const securityRoutes = Router();

// ─── Cameras ──────────────────────────────────────────────
securityRoutes.get(
  "/cameras",
  authRequired,
  asyncHandler(async (req, res) => {
    const cameras = await prisma.camera.findMany({
      where: { restaurantId: req.user!.restaurantId, active: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(cameras);
  })
);

const createCameraSchema = z.object({
  name: z.string().min(1).max(80),
  location: z.enum(["CAJA", "COCINA", "SALON", "BARRA", "PUERTA_TRASERA", "ALMACEN", "OTRO"]),
  rtspUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional()
});

securityRoutes.post(
  "/cameras",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createCameraSchema.parse(req.body);
    const camera = await prisma.camera.create({
      data: { ...data, restaurantId: req.user!.restaurantId }
    });
    res.status(201).json(camera);
  })
);

securityRoutes.patch(
  "/cameras/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const cam = await prisma.camera.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId }
    });
    if (!cam) throw new HttpError(404, "camera_not_found");
    const updated = await prisma.camera.update({
      where: { id: cam.id },
      data: req.body
    });
    res.json(updated);
  })
);

securityRoutes.delete(
  "/cameras/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const cam = await prisma.camera.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId }
    });
    if (!cam) throw new HttpError(404, "camera_not_found");
    await prisma.camera.update({
      where: { id: cam.id },
      data: { active: false }
    });
    res.status(204).end();
  })
);

// ─── Alerts ──────────────────────────────────────────────
const listAlertsSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  cameraId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50)
});

securityRoutes.get(
  "/alerts",
  authRequired,
  asyncHandler(async (req, res) => {
    const q = listAlertsSchema.parse(req.query);
    const where: any = { restaurantId: req.user!.restaurantId };
    if (q.status) where.status = q.status;
    if (q.severity) where.severity = q.severity;
    if (q.cameraId) where.cameraId = q.cameraId;
    if (q.from || q.to) {
      where.detectedAt = {};
      if (q.from) where.detectedAt.gte = new Date(q.from);
      if (q.to) where.detectedAt.lte = new Date(q.to);
    }
    const alerts = await prisma.securityAlert.findMany({
      where,
      include: { camera: true },
      orderBy: { detectedAt: "desc" },
      take: q.limit
    });
    res.json(alerts);
  })
);

securityRoutes.get(
  "/alerts/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const alert = await prisma.securityAlert.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { camera: true }
    });
    if (!alert) throw new HttpError(404, "alert_not_found");
    res.json(alert);
  })
);

const reviewAlertSchema = z.object({
  status: z.enum(["REVIEWING", "CONFIRMED", "DISMISSED", "ESCALATED"]),
  actionTaken: z.enum([
    "VERBAL_WARNING",
    "WRITTEN_WARNING",
    "TERMINATION",
    "NO_ACTION",
    "INVESTIGATING",
    "LEGAL_ACTION"
  ]).optional(),
  notes: z.string().max(2000).optional(),
  estimatedLossCents: z.number().int().min(0).optional()
});

securityRoutes.patch(
  "/alerts/:id/review",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = reviewAlertSchema.parse(req.body);
    const alert = await prisma.securityAlert.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId }
    });
    if (!alert) throw new HttpError(404, "alert_not_found");

    const updated = await prisma.securityAlert.update({
      where: { id: alert.id },
      data: {
        ...data,
        reviewedById: req.user!.userId,
        reviewedAt: new Date()
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        action: "SECURITY_ALERT_REVIEW",
        entityType: "SecurityAlert",
        entityId: alert.id,
        before: JSON.stringify({ status: alert.status, actionTaken: alert.actionTaken }),
        after: JSON.stringify({ status: updated.status, actionTaken: updated.actionTaken }),
        reason: data.notes
      }
    });

    res.json(updated);
  })
);

// ─── Analyze frame (puede ser llamado por el worker o demo) ───────
const analyzeSchema = z.object({
  cameraId: z.string(),
  imageBase64: z.string().min(100), // demo permite base64 corto, prod usar magic bytes
  context: z.string().optional()
});

securityRoutes.post(
  "/analyze-frame",
  authRequired,
  asyncHandler(async (req, res) => {
    const { cameraId, imageBase64, context } = analyzeSchema.parse(req.body);

    const camera = await prisma.camera.findFirst({
      where: { id: cameraId, restaurantId: req.user!.restaurantId }
    });
    if (!camera) throw new HttpError(404, "camera_not_found");

    // Reglas habilitadas
    const rules = await prisma.securityRule.findMany({
      where: { restaurantId: req.user!.restaurantId, enabled: true }
    });
    const enabledTypes = rules.length > 0
      ? rules.map(r => r.type as any)
      : (["FAKE_RECEIPT", "THEFT_INVENTORY", "OPEN_REGISTER_NO_TX", "UNRECORDED_CONSUMPTION", "UNUSUAL_AREA"] as any);

    const result = await analyzeFrame({
      imageBase64,
      cameraLocation: camera.location,
      context,
      detectionRules: enabledTypes
    });

    if (!result.alertDetected) {
      return res.json({ ok: true, alertDetected: false, source: result.source });
    }

    // Guardamos la alerta
    const alert = await prisma.securityAlert.create({
      data: {
        restaurantId: req.user!.restaurantId,
        cameraId: camera.id,
        type: result.type!,
        severity: result.severity!,
        title: result.title!,
        description: result.description!,
        aiRationale: result.rationale,
        aiConfidence: result.confidence,
        estimatedLossCents: result.estimatedLossCents || 0,
        snapshotUrl: undefined // en prod: subir el frame a S3 y guardar URL
      },
      include: { camera: true }
    });

    res.status(201).json({ ok: true, alert, source: result.source });
  })
);

// ─── Rules ──────────────────────────────────────────────
securityRoutes.get(
  "/rules",
  authRequired,
  asyncHandler(async (req, res) => {
    const rules = await prisma.securityRule.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: { type: "asc" }
    });
    res.json(rules);
  })
);

const upsertRuleSchema = z.object({
  enabled: z.boolean(),
  sensitivity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  schedule: z.string().optional(),
  notifyEmail: z.string().email().optional(),
  notifyWhatsApp: z.string().optional()
});

securityRoutes.put(
  "/rules/:type",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = upsertRuleSchema.parse(req.body);
    const type = req.params.type;

    const rule = await prisma.securityRule.upsert({
      where: { restaurantId_type: { restaurantId: req.user!.restaurantId, type } },
      create: { restaurantId: req.user!.restaurantId, type, ...data },
      update: data
    });
    res.json(rule);
  })
);

// ─── Stats ──────────────────────────────────────────────
securityRoutes.get(
  "/stats",
  authRequired,
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [pending, weeklyAlerts, totalLoss, byType] = await Promise.all([
      prisma.securityAlert.count({ where: { restaurantId, status: "PENDING" } }),
      prisma.securityAlert.count({ where: { restaurantId, detectedAt: { gte: since } } }),
      prisma.securityAlert.aggregate({
        where: { restaurantId, status: "CONFIRMED", detectedAt: { gte: since } },
        _sum: { estimatedLossCents: true }
      }),
      prisma.securityAlert.groupBy({
        by: ["type"],
        where: { restaurantId, detectedAt: { gte: since } },
        _count: true
      })
    ]);

    const cameras = await prisma.camera.count({
      where: { restaurantId, active: true, status: "ONLINE" }
    });

    res.json({
      pendingReview: pending,
      weeklyAlerts,
      weeklyLossCents: totalLoss._sum.estimatedLossCents || 0,
      activeCameras: cameras,
      byType
    });
  })
);
