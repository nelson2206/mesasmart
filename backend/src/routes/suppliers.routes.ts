import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { purchaseService } from "../services/purchase.service.js";

export const supplierRoutes = Router();

supplierRoutes.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const suppliers = await prisma.supplier.findMany({
      where: { restaurantId: req.user!.restaurantId, active: true },
      include: { _count: { select: { ingredients: true } } },
      orderBy: { name: "asc" }
    });
    res.json(suppliers);
  })
);

const supSchema = z.object({
  name: z.string(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  ruc: z.string().optional(),
  paymentTerms: z.enum(["CONTADO", "CREDITO_15", "CREDITO_30"]).optional(),
  deliveryDays: z.array(z.number().int().min(1).max(7)).optional(),
  autoOrderEnabled: z.boolean().optional(),
  notes: z.string().optional()
});

supplierRoutes.post(
  "/",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = supSchema.parse(req.body);
    const sup = await prisma.supplier.create({
      data: {
        ...data,
        deliveryDays: JSON.stringify(data.deliveryDays ?? []),
        restaurantId: req.user!.restaurantId
      }
    });
    res.status(201).json(sup);
  })
);

supplierRoutes.patch(
  "/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = supSchema.partial().parse(req.body);
    const update: any = { ...data };
    if (data.deliveryDays) update.deliveryDays = JSON.stringify(data.deliveryDays);
    const sup = await prisma.supplier.update({ where: { id: req.params.id }, data: update });
    res.json(sup);
  })
);

// Trigger auto-restock — generates draft POs
supplierRoutes.post(
  "/auto-restock",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const result = await purchaseService.runAutoRestock(req.user!.restaurantId);
    res.json(result);
  })
);

// ─── Purchase Orders ──────────────────
supplierRoutes.get(
  "/purchase-orders",
  authRequired,
  asyncHandler(async (req, res) => {
    const where: any = { restaurantId: req.user!.restaurantId };
    if (req.query.status) where.status = req.query.status;
    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, lines: { include: { ingredient: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(pos);
  })
);

supplierRoutes.get(
  "/purchase-orders/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { supplier: true, lines: { include: { ingredient: true } } }
    });
    if (!po) throw new HttpError(404, "not_found");
    res.json(po);
  })
);

supplierRoutes.post(
  "/purchase-orders/:id/send",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const po = await purchaseService.markSent(req.params.id);
    res.json(po);
  })
);

const receiveSchema = z.object({
  lines: z.array(z.object({
    lineId: z.string(),
    qtyReceived: z.number().min(0),
    expirationDate: z.string().optional()
  }))
});

supplierRoutes.post(
  "/purchase-orders/:id/receive",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { lines } = receiveSchema.parse(req.body);
    const po = await purchaseService.receive(req.params.id, lines, req.user!.userId);
    res.json(po);
  })
);
