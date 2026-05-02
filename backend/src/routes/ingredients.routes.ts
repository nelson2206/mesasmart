import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { inventoryService } from "../services/inventory.service.js";

export const ingredientRoutes = Router();

// List
ingredientRoutes.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const where: any = { restaurantId: req.user!.restaurantId, active: true };
    if (req.query.categoryId) where.categoryId = req.query.categoryId;
    if (req.query.lowStock === "true") {
      // computed in app — fetch all and filter
    }
    const items = await prisma.ingredient.findMany({
      where,
      include: { category: true, supplier: true },
      orderBy: { name: "asc" }
    });
    const enriched = items.map(i => ({
      ...i,
      stockStatus: i.currentStock <= i.criticalStock ? "critical" : i.currentStock <= i.minStock ? "low" : "ok",
      stockValueCents: Math.round(i.currentStock * i.avgCostPerUnitCents)
    }));
    res.json(req.query.lowStock === "true" ? enriched.filter(e => e.stockStatus !== "ok") : enriched);
  })
);

// Categories
ingredientRoutes.get(
  "/categories",
  authRequired,
  asyncHandler(async (req, res) => {
    const cats = await prisma.ingredientCategory.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: { displayOrder: "asc" }
    });
    res.json(cats);
  })
);

// Get single
ingredientRoutes.get(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const ing = await prisma.ingredient.findUnique({
      where: { id: req.params.id },
      include: { category: true, supplier: true, expirationLots: { where: { status: "ACTIVE" }, orderBy: { expirationDate: "asc" } } }
    });
    if (!ing) throw new HttpError(404, "not_found");
    res.json(ing);
  })
);

// Movement history (kardex)
ingredientRoutes.get(
  "/:id/movements",
  authRequired,
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 50);
    const movements = await prisma.inventoryMovement.findMany({
      where: { ingredientId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    res.json(movements);
  })
);

// Create / update
const upsertSchema = z.object({
  name: z.string(),
  unit: z.string(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  currentStock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  criticalStock: z.number().min(0).optional(),
  optimalStock: z.number().min(0).optional(),
  costPerUnitCents: z.number().int().min(0).optional(),
  trackExpiration: z.boolean().optional(),
  notes: z.string().optional()
});

ingredientRoutes.post(
  "/",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = upsertSchema.parse(req.body);
    const ing = await prisma.ingredient.create({
      data: { ...data, restaurantId: req.user!.restaurantId, avgCostPerUnitCents: data.costPerUnitCents ?? 0 }
    });
    res.status(201).json(ing);
  })
);

ingredientRoutes.patch(
  "/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = upsertSchema.partial().parse(req.body);
    const ing = await prisma.ingredient.update({ where: { id: req.params.id }, data });
    res.json(ing);
  })
);

// Quick stock adjustment (e.g., merma, sobrante)
const adjustSchema = z.object({
  newQty: z.number().min(0),
  reason: z.string()
});

ingredientRoutes.post(
  "/:id/adjust",
  authRequired,
  asyncHandler(async (req, res) => {
    const { newQty, reason } = adjustSchema.parse(req.body);
    await inventoryService.adjustStock({
      ingredientId: req.params.id,
      newQty,
      reason,
      userId: req.user!.userId
    });
    const ing = await prisma.ingredient.findUnique({ where: { id: req.params.id } });
    res.json(ing);
  })
);

// Restock alerts (critical + low)
ingredientRoutes.get(
  "/alerts/restock",
  authRequired,
  asyncHandler(async (req, res) => {
    const items = await inventoryService.getCriticalStock(req.user!.restaurantId);
    res.json(items);
  })
);

// Expiring lots
ingredientRoutes.get(
  "/alerts/expiring",
  authRequired,
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 5);
    const lots = await inventoryService.getExpiringLots(req.user!.restaurantId, days);
    res.json(lots);
  })
);
