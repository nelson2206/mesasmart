import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { inventoryService } from "../services/inventory.service.js";
import { aiService } from "../services/ai.service.js";

export const inventoryRoutes = Router();

// ─── Counts (inventariado físico) ──────────────────
inventoryRoutes.get(
  "/counts",
  authRequired,
  asyncHandler(async (req, res) => {
    const counts = await prisma.inventoryCount.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    res.json(counts);
  })
);

inventoryRoutes.get(
  "/counts/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const count = await prisma.inventoryCount.findUnique({
      where: { id: req.params.id },
      include: { lines: { include: { ingredient: { include: { category: true } } } } }
    });
    if (!count) throw new HttpError(404, "not_found");
    res.json(count);
  })
);

// Start a new count
const startSchema = z.object({
  scope: z.enum(["FULL", "PARTIAL", "CATEGORY", "SPOTCHECK"]).default("FULL"),
  ingredientIds: z.array(z.string()).optional()
});

inventoryRoutes.post(
  "/counts",
  authRequired,
  asyncHandler(async (req, res) => {
    const { scope, ingredientIds } = startSchema.parse(req.body);
    const count = await inventoryService.startCount(
      req.user!.restaurantId,
      req.user!.userId,
      scope,
      ingredientIds
    );
    res.status(201).json(count);
  })
);

// Update a line (manual count entry)
const updateLineSchema = z.object({
  actualQty: z.number().min(0),
  notes: z.string().optional()
});

inventoryRoutes.patch(
  "/counts/:countId/lines/:lineId",
  authRequired,
  asyncHandler(async (req, res) => {
    const { actualQty, notes } = updateLineSchema.parse(req.body);
    const line = await prisma.inventoryCountLine.update({
      where: { id: req.params.lineId },
      data: { actualQty, notes }
    });
    res.json(line);
  })
);

// Complete a count → applies variance, locks
inventoryRoutes.post(
  "/counts/:id/complete",
  authRequired,
  asyncHandler(async (req, res) => {
    const count = await inventoryService.completeCount(req.params.id);
    res.json(count);
  })
);

// ─── Photo-based AI count ──────────────────
const photoCountSchema = z.object({
  imageBase64: z.string().min(100),
  imageMediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  context: z.string().optional(),
  ingredientIds: z.array(z.string()).optional() // restrict catalog to these
});

inventoryRoutes.post(
  "/counts/photo",
  authRequired,
  asyncHandler(async (req, res) => {
    const { imageBase64, imageMediaType, context, ingredientIds } = photoCountSchema.parse(req.body);
    const filter: any = { restaurantId: req.user!.restaurantId, active: true };
    if (ingredientIds?.length) filter.id = { in: ingredientIds };
    const ingredients = await prisma.ingredient.findMany({
      where: filter,
      select: { id: true, name: true, unit: true }
    });

    const result = await aiService.countIngredientsFromPhoto({
      imageBase64,
      imageMediaType,
      expectedIngredients: ingredients,
      context
    });

    if (!result) {
      return res.status(503).json({
        error: "ai_unavailable",
        message: "AI no está habilitado o no pudo procesar la imagen. Configura ANTHROPIC_API_KEY y AI_FEATURES_ENABLED=true."
      });
    }

    res.json(result);
  })
);

// ─── Movements (kardex) ──────────────────
inventoryRoutes.get(
  "/movements",
  authRequired,
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    const where: any = { ingredient: { restaurantId: req.user!.restaurantId } };
    if (req.query.type) where.type = req.query.type;
    if (req.query.ingredientId) where.ingredientId = req.query.ingredientId;

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    res.json(movements);
  })
);

// ─── Summary KPIs ──────────────────
inventoryRoutes.get(
  "/summary",
  authRequired,
  asyncHandler(async (req, res) => {
    const ings = await prisma.ingredient.findMany({ where: { restaurantId: req.user!.restaurantId, active: true } });
    const totalValueCents = ings.reduce((s, i) => s + Math.round(i.currentStock * i.avgCostPerUnitCents), 0);
    const critical = ings.filter(i => i.currentStock <= i.criticalStock).length;
    const low = ings.filter(i => i.currentStock <= i.minStock && i.currentStock > i.criticalStock).length;
    const ok = ings.length - critical - low;

    const expiring = await inventoryService.getExpiringLots(req.user!.restaurantId, 5);
    const expiringValueCents = expiring.reduce((s, l) => s + l.valueCents, 0);

    res.json({
      totalSku: ings.length,
      totalValueCents,
      critical,
      low,
      ok,
      expiringSoon: expiring.length,
      expiringValueCents
    });
  })
);
