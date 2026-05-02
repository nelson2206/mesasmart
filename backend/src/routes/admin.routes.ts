/**
 * MesaSmart · Admin maintenance endpoints
 * Solo ADMIN, idempotentes, sin destruir datos.
 *
 * Estos endpoints existen para correr migraciones de datos
 * cuando no tienes acceso al Shell del servidor.
 */
import { Router } from "express";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminRoutes = Router();

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/backfill/transformations
// Crea las 6 IngredientTransformation de demo si no existen.
// Si faltan ingredientes intermedios/preparados, los crea también.
// Idempotente: si ya existe la transformación o el ingrediente, salta.
// ═══════════════════════════════════════════════════════════════
const TRANSFORMATIONS = [
  { fromName: "Pescado bonito entero", toName: "Pescado sin vísceras", inputQty: 1.0, outputQty: 0.80, laborMinutes: 5, station: "frio" },
  { fromName: "Pescado sin vísceras",  toName: "Pescado fileteado",   inputQty: 1.0, outputQty: 0.75, laborMinutes: 8, station: "frio" },
  { fromName: "Pescado fileteado",     toName: "Pescado picado",      inputQty: 1.0, outputQty: 0.92, laborMinutes: 12, station: "prep" },
  { fromName: "Pollo entero",          toName: "Pollo trozado",       inputQty: 1.0, outputQty: 0.95, laborMinutes: 5, station: "frio" },
  { fromName: "Pollo trozado",         toName: "Pechugas deshuesadas",inputQty: 1.0, outputQty: 0.70, laborMinutes: 4, station: "frio" },
  { fromName: "Carne de res (lomo)",   toName: "Lomo limpio",         inputQty: 1.0, outputQty: 0.88, laborMinutes: 6, station: "frio" }
];

const INTERMEDIATE_INGS: Array<{ name: string; unit: string; level: "INTERMEDIATE" | "PREPARED" }> = [
  { name: "Pollo trozado",         unit: "kg", level: "INTERMEDIATE" },
  { name: "Pechugas deshuesadas",  unit: "kg", level: "PREPARED" },
  { name: "Pescado sin vísceras",  unit: "kg", level: "INTERMEDIATE" },
  { name: "Pescado fileteado",     unit: "kg", level: "INTERMEDIATE" },
  { name: "Pescado picado",        unit: "kg", level: "PREPARED" },
  { name: "Lomo limpio",           unit: "kg", level: "PREPARED" }
];

adminRoutes.post(
  "/backfill/transformations",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const log: string[] = [];
    const summary = { ingredientsCreated: 0, transformationsCreated: 0, skipped: 0 };

    // 1. Asegurar categoría "Proteínas" y proveedor base
    let cat = await prisma.ingredientCategory.findFirst({
      where: { restaurantId, name: "Proteínas" }
    });
    if (!cat) {
      cat = await prisma.ingredientCategory.create({
        data: { restaurantId, name: "Proteínas", color: "#A0322B" }
      });
      log.push("✓ Creada categoría Proteínas");
    }

    let sup = await prisma.supplier.findFirst({ where: { restaurantId } });
    if (!sup) {
      sup = await prisma.supplier.create({
        data: { restaurantId, name: "Proveedor Base", contact: "—", phone: "—" }
      });
      log.push("✓ Creado proveedor base");
    }

    // 2. Asegurar ingredientes intermedios/preparados
    for (const ing of INTERMEDIATE_INGS) {
      const exists = await prisma.ingredient.findFirst({
        where: { restaurantId, name: ing.name }
      });
      if (!exists) {
        await prisma.ingredient.create({
          data: {
            restaurantId,
            categoryId: cat.id,
            supplierId: sup.id,
            name: ing.name,
            unit: ing.unit,
            current: 0,
            min: 0,
            critical: 0,
            optimal: 5,
            costCents: 0,
            perishable: true,
            level: ing.level
          }
        });
        summary.ingredientsCreated++;
        log.push(`✓ Ingrediente intermedio creado: ${ing.name}`);
      }
    }

    // 3. Crear transformaciones (skip si ya existen)
    for (const t of TRANSFORMATIONS) {
      const fromIng = await prisma.ingredient.findFirst({
        where: { restaurantId, name: t.fromName }
      });
      const toIng = await prisma.ingredient.findFirst({
        where: { restaurantId, name: t.toName }
      });
      if (!fromIng || !toIng) {
        log.push(`⚠ Skip ${t.fromName} → ${t.toName} (ingrediente no encontrado)`);
        summary.skipped++;
        continue;
      }
      const dup = await prisma.ingredientTransformation.findFirst({
        where: {
          restaurantId,
          fromIngredientId: fromIng.id,
          toIngredientId: toIng.id
        }
      });
      if (dup) {
        summary.skipped++;
        continue;
      }

      const yieldPct = (t.outputQty / t.inputQty) * 100;
      const laborCostCents = Math.round(t.laborMinutes * 50);

      await prisma.ingredientTransformation.create({
        data: {
          restaurantId,
          fromIngredientId: fromIng.id,
          toIngredientId: toIng.id,
          inputQty: t.inputQty,
          outputQty: t.outputQty,
          yieldPct,
          laborMinutes: t.laborMinutes,
          laborCostCents,
          station: t.station
        }
      });
      summary.transformationsCreated++;
      log.push(`✓ ${t.fromName} → ${t.toName} (yield ${yieldPct.toFixed(0)}%)`);
    }

    res.json({ ok: true, restaurantId, summary, log });
  })
);

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/health/data
// Reporte rápido de cuántos registros tiene el restaurante
// ═══════════════════════════════════════════════════════════════
adminRoutes.get(
  "/health/data",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const [
      ingredients, transformations, suppliers,
      menuItems, recipes, orders,
      employees, customers
    ] = await Promise.all([
      prisma.ingredient.count({ where: { restaurantId } }),
      prisma.ingredientTransformation.count({ where: { restaurantId } }),
      prisma.supplier.count({ where: { restaurantId } }),
      prisma.menuItem.count({ where: { restaurantId } }),
      prisma.recipeIngredient.count({ where: { menuItem: { restaurantId } } }),
      prisma.order.count({ where: { restaurantId } }),
      prisma.user.count({ where: { restaurantId } }),
      prisma.customer.count({ where: { restaurantId } })
    ]);

    res.json({
      restaurantId,
      counts: {
        ingredients, transformations, suppliers,
        menuItems, recipes, orders,
        employees, customers
      },
      flags: {
        needsTransformationsBackfill: transformations === 0 && ingredients > 0
      }
    });
  })
);
