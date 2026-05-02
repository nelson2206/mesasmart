import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";

export const recipeRoutes = Router();

// Get recipe of a menu item
recipeRoutes.get(
  "/menu-items/:id/recipe",
  authRequired,
  asyncHandler(async (req, res) => {
    const rows = await prisma.recipeIngredient.findMany({
      where: { menuItemId: req.params.id },
      include: { ingredient: true }
    });
    const totalCostCents = rows.reduce(
      (s, r) => s + Math.round(r.qty * r.ingredient.avgCostPerUnitCents),
      0
    );
    const item = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    res.json({
      menuItem: item,
      ingredients: rows,
      totalCostCents,
      foodCostPct: item ? (totalCostCents / item.priceCents) * 100 : 0,
      marginCents: item ? item.priceCents - totalCostCents : 0
    });
  })
);

// Set/replace recipe (overwrites)
const recipeSchema = z.object({
  ingredients: z.array(
    z.object({
      ingredientId: z.string(),
      qty: z.number().positive(),
      unit: z.string(),
      notes: z.string().optional()
    })
  )
});

recipeRoutes.put(
  "/menu-items/:id/recipe",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { ingredients } = recipeSchema.parse(req.body);
    await prisma.recipeIngredient.deleteMany({ where: { menuItemId: req.params.id } });
    for (const i of ingredients) {
      await prisma.recipeIngredient.create({
        data: { ...i, menuItemId: req.params.id }
      });
    }
    res.json({ ok: true, count: ingredients.length });
  })
);

// Add single ingredient to recipe
recipeRoutes.post(
  "/menu-items/:id/recipe/ingredients",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const i = z
      .object({ ingredientId: z.string(), qty: z.number().positive(), unit: z.string(), notes: z.string().optional() })
      .parse(req.body);
    const row = await prisma.recipeIngredient.upsert({
      where: { menuItemId_ingredientId: { menuItemId: req.params.id, ingredientId: i.ingredientId } },
      create: { ...i, menuItemId: req.params.id },
      update: { qty: i.qty, unit: i.unit, notes: i.notes }
    });
    res.status(201).json(row);
  })
);

// Remove ingredient from recipe
recipeRoutes.delete(
  "/menu-items/:menuId/recipe/ingredients/:ingId",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.recipeIngredient.delete({
      where: { menuItemId_ingredientId: { menuItemId: req.params.menuId, ingredientId: req.params.ingId } }
    });
    res.json({ ok: true });
  })
);

// Get all menu items + recipe coverage (which have recipes, which don't)
recipeRoutes.get(
  "/coverage",
  authRequired,
  asyncHandler(async (req, res) => {
    const items = await prisma.menuItem.findMany({
      where: { category: { restaurantId: req.user!.restaurantId } },
      include: { _count: { select: {} as any } }
    });
    const recipes = await prisma.recipeIngredient.groupBy({
      by: ["menuItemId"],
      _count: true
    });
    const recipeMap = new Map(recipes.map(r => [r.menuItemId, r._count]));
    const enriched = items.map(i => ({
      id: i.id,
      name: i.name,
      priceCents: i.priceCents,
      hasRecipe: recipeMap.has(i.id),
      ingredientCount: recipeMap.get(i.id) ?? 0
    }));
    const withRecipe = enriched.filter(e => e.hasRecipe).length;
    res.json({
      coveragePct: items.length > 0 ? (withRecipe / items.length) * 100 : 0,
      withRecipe,
      total: items.length,
      items: enriched
    });
  })
);
