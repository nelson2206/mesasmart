import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";

export const menuRoutes = Router();

// Public-ish: cliente needs the menu (auth via qrToken in real prod)
menuRoutes.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const restaurantId = (req.query.restaurantId as string) ?? req.user?.restaurantId;
    if (!restaurantId) throw new HttpError(400, "missing_restaurant");
    const cats = await prisma.menuCategory.findMany({
      where: { restaurantId, active: true },
      orderBy: { displayOrder: "asc" }
    });
    res.json(cats);
  })
);

menuRoutes.get(
  "/items",
  asyncHandler(async (req, res) => {
    const restaurantId = (req.query.restaurantId as string) ?? req.user?.restaurantId;
    if (!restaurantId) throw new HttpError(400, "missing_restaurant");

    const filter: any = { category: { restaurantId } };
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.search) {
      const q = req.query.search as string;
      filter.OR = [
        { name: { contains: q } },
        { description: { contains: q } }
      ];
    }
    if (req.query.available === "true") filter.available = true;

    const items = await prisma.menuItem.findMany({
      where: filter,
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" }
    });

    // Parse tags JSON for frontend convenience
    res.json(items.map(i => ({ ...i, tags: JSON.parse(i.tags) })));
  })
);

menuRoutes.get(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const item = await prisma.menuItem.findUnique({
      where: { id: req.params.id },
      include: { category: true }
    });
    if (!item) throw new HttpError(404, "not_found");
    res.json({ ...item, tags: JSON.parse(item.tags) });
  })
);

// Admin: CRUD
const itemCreateSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().positive(),
  prepMinutes: z.number().int().min(1).default(10),
  kitchenStation: z.enum(["brasa", "parrilla", "frio", "bebidas", "postres"]).default("brasa"),
  spicy: z.number().int().min(0).max(3).default(0),
  calories: z.number().int().optional(),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional()
});

menuRoutes.post(
  "/items",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = itemCreateSchema.parse(req.body);
    const item = await prisma.menuItem.create({
      data: { ...data, tags: JSON.stringify(data.tags) }
    });
    res.status(201).json({ ...item, tags: JSON.parse(item.tags) });
  })
);

menuRoutes.patch(
  "/items/:id/availability",
  authRequired,
  requireRole("ADMIN", "KITCHEN"),
  asyncHandler(async (req, res) => {
    const { available } = z.object({ available: z.boolean() }).parse(req.body);
    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: { available }
    });
    res.json(item);
  })
);
