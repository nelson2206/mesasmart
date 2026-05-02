/**
 * Inventory Service
 * ────────────────────
 * Gestión central de stock, recetas, kardex (movimientos), conteos físicos,
 * lotes con fecha de caducidad y variance entre esperado vs real.
 *
 * Concepto clave: cuando un OrderItem llega a estado SERVED, se descuentan
 * automáticamente los ingredientes según la receta del MenuItem. Cada
 * descuento queda registrado en InventoryMovement (kardex). Los conteos
 * físicos comparan stock esperado (sistema) vs real (físico) y producen
 * un reporte de variance valorizado.
 */

import { prisma } from "../prisma.js";
import { logger } from "../utils/logger.js";

export interface DeductInput {
  orderItemId: string;
  userId?: string;
}

class InventoryService {
  /**
   * Descuenta ingredientes del inventario según la receta del menu item.
   * Llamado cuando un OrderItem cambia a SERVED.
   * Idempotente: si ya hubo movimiento para este OrderItem, no descuenta de nuevo.
   */
  async deductForOrderItem(input: DeductInput): Promise<{ deducted: { ingredient: string; qty: number }[]; warnings: string[] }> {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: input.orderItemId },
      include: { menuItem: true }
    });
    if (!orderItem) return { deducted: [], warnings: ["order item not found"] };

    // Already deducted?
    const existing = await prisma.inventoryMovement.findFirst({
      where: { refType: "ORDER_ITEM", refId: orderItem.id }
    });
    if (existing) return { deducted: [], warnings: ["already deducted"] };

    const recipeRows = await prisma.recipeIngredient.findMany({
      where: { menuItemId: orderItem.menuItemId },
      include: { ingredient: true }
    });

    if (recipeRows.length === 0) {
      logger.warn({ menuItemId: orderItem.menuItemId, name: orderItem.menuItem.name }, "Menu item has no recipe — skipping inventory deduction");
      return { deducted: [], warnings: [`Sin receta definida para ${orderItem.menuItem.name}`] };
    }

    const deducted: { ingredient: string; qty: number }[] = [];
    const warnings: string[] = [];

    for (const row of recipeRows) {
      const consumeQty = row.qty * orderItem.qty;
      const newStock = row.ingredient.currentStock - consumeQty;
      const totalCostCents = Math.round(consumeQty * row.ingredient.avgCostPerUnitCents);

      // Update ingredient stock
      await prisma.ingredient.update({
        where: { id: row.ingredientId },
        data: { currentStock: newStock }
      });

      // Record movement (negative qty = outbound)
      await prisma.inventoryMovement.create({
        data: {
          ingredientId: row.ingredientId,
          type: "SALE_DEDUCT",
          qty: -consumeQty,
          unitCostCents: row.ingredient.avgCostPerUnitCents,
          totalCostCents: -totalCostCents,
          refType: "ORDER_ITEM",
          refId: orderItem.id,
          userId: input.userId,
          notes: `${orderItem.qty}× ${orderItem.menuItem.name}`
        }
      });

      // Consume from oldest lot first (FEFO) for perishables
      if (row.ingredient.trackExpiration) {
        await this.consumeFromLots(row.ingredientId, consumeQty);
      }

      deducted.push({ ingredient: row.ingredient.name, qty: consumeQty });

      // Stock alerts
      if (newStock <= row.ingredient.criticalStock) {
        warnings.push(`CRITICO · ${row.ingredient.name}: ${newStock.toFixed(2)} ${row.ingredient.unit} (mínimo ${row.ingredient.criticalStock})`);
      } else if (newStock <= row.ingredient.minStock) {
        warnings.push(`Stock bajo · ${row.ingredient.name}: ${newStock.toFixed(2)} ${row.ingredient.unit}`);
      }
    }

    return { deducted, warnings };
  }

  /**
   * Consume qty desde los lotes más antiguos primero (FEFO).
   */
  private async consumeFromLots(ingredientId: string, qty: number) {
    let remaining = qty;
    const lots = await prisma.expirationLot.findMany({
      where: { ingredientId, status: "ACTIVE", qtyRemaining: { gt: 0 } },
      orderBy: { expirationDate: "asc" }
    });
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.qtyRemaining, remaining);
      const newRem = lot.qtyRemaining - take;
      await prisma.expirationLot.update({
        where: { id: lot.id },
        data: {
          qtyRemaining: newRem,
          status: newRem <= 0 ? "CONSUMED" : "ACTIVE"
        }
      });
      remaining -= take;
    }
  }

  /**
   * Add stock (purchase, manual adjustment, return).
   */
  async addStock(input: {
    ingredientId: string;
    qty: number;
    unitCostCents: number;
    type: "PURCHASE" | "ADJUSTMENT" | "RETURN";
    refType?: string;
    refId?: string;
    expirationDate?: Date;
    userId?: string;
    notes?: string;
  }) {
    const ing = await prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
    if (!ing) throw new Error("ingredient_not_found");

    const totalCostCents = Math.round(input.qty * input.unitCostCents);

    // Weighted average cost
    const oldValue = ing.currentStock * ing.avgCostPerUnitCents;
    const newValue = input.qty * input.unitCostCents;
    const newStock = ing.currentStock + input.qty;
    const newAvg = newStock > 0 ? Math.round((oldValue + newValue) / newStock) : ing.avgCostPerUnitCents;

    await prisma.ingredient.update({
      where: { id: ing.id },
      data: {
        currentStock: newStock,
        costPerUnitCents: input.unitCostCents,
        avgCostPerUnitCents: newAvg
      }
    });

    await prisma.inventoryMovement.create({
      data: {
        ingredientId: ing.id,
        type: input.type,
        qty: input.qty,
        unitCostCents: input.unitCostCents,
        totalCostCents,
        refType: input.refType,
        refId: input.refId,
        userId: input.userId,
        notes: input.notes
      }
    });

    if (input.expirationDate && ing.trackExpiration) {
      await prisma.expirationLot.create({
        data: {
          ingredientId: ing.id,
          qty: input.qty,
          qtyRemaining: input.qty,
          unitCostCents: input.unitCostCents,
          expirationDate: input.expirationDate,
          sourcePoId: input.refType === "PURCHASE_ORDER" ? input.refId : undefined,
          status: "ACTIVE"
        }
      });
    }
  }

  /**
   * Manual adjustment (e.g., chef wastes ingredient).
   */
  async adjustStock(input: {
    ingredientId: string;
    newQty: number;
    reason: string;
    userId?: string;
  }) {
    const ing = await prisma.ingredient.findUnique({ where: { id: input.ingredientId } });
    if (!ing) throw new Error("ingredient_not_found");
    const delta = input.newQty - ing.currentStock;

    await prisma.ingredient.update({
      where: { id: ing.id },
      data: { currentStock: input.newQty }
    });

    await prisma.inventoryMovement.create({
      data: {
        ingredientId: ing.id,
        type: delta < 0 ? "WASTE" : "ADJUSTMENT",
        qty: delta,
        unitCostCents: ing.avgCostPerUnitCents,
        totalCostCents: Math.round(delta * ing.avgCostPerUnitCents),
        refType: "MANUAL",
        userId: input.userId,
        notes: input.reason
      }
    });
  }

  /**
   * Start a physical inventory count. Snapshots current stock as expected.
   */
  async startCount(restaurantId: string, userId: string, scope: "FULL" | "PARTIAL" | "CATEGORY" | "SPOTCHECK", ingredientIds?: string[]) {
    const filter: any = { restaurantId, active: true };
    if (ingredientIds?.length) filter.id = { in: ingredientIds };

    const ingredients = await prisma.ingredient.findMany({ where: filter });

    return prisma.inventoryCount.create({
      data: {
        restaurantId,
        userId,
        scope,
        status: "DRAFT",
        lines: {
          create: ingredients.map(ing => ({
            ingredientId: ing.id,
            expectedQty: ing.currentStock,
            actualQty: ing.currentStock, // pre-fill, user adjusts
            varianceQty: 0,
            varianceCents: 0
          }))
        }
      },
      include: { lines: true }
    });
  }

  /**
   * Complete count: apply variances, record movements, recalc totals.
   */
  async completeCount(countId: string) {
    const count = await prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: { lines: { include: { ingredient: true } } }
    });
    if (!count) throw new Error("count_not_found");
    if (count.status !== "DRAFT") throw new Error("count_already_completed");

    let totalVarianceQty = 0;
    let totalVarianceCents = 0;

    for (const line of count.lines) {
      const variance = line.actualQty - line.expectedQty;
      const varianceCents = Math.round(variance * line.ingredient.avgCostPerUnitCents);
      totalVarianceQty += variance;
      totalVarianceCents += varianceCents;

      // Persist line variance
      await prisma.inventoryCountLine.update({
        where: { id: line.id },
        data: { varianceQty: variance, varianceCents }
      });

      // If there's a variance, adjust stock and record movement
      if (variance !== 0) {
        await prisma.ingredient.update({
          where: { id: line.ingredientId },
          data: { currentStock: line.actualQty }
        });
        await prisma.inventoryMovement.create({
          data: {
            ingredientId: line.ingredientId,
            type: variance < 0 ? "WASTE" : "ADJUSTMENT",
            qty: variance,
            unitCostCents: line.ingredient.avgCostPerUnitCents,
            totalCostCents: varianceCents,
            refType: "INVENTORY_COUNT",
            refId: count.id,
            notes: variance < 0 ? "Merma detectada en inventariado" : "Sobrante detectado en inventariado"
          }
        });
      }
    }

    return prisma.inventoryCount.update({
      where: { id: countId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalVarianceQty,
        totalVarianceCents
      },
      include: { lines: { include: { ingredient: true } } }
    });
  }

  /**
   * List ingredients needing replenishment (stock <= criticalStock).
   */
  async getCriticalStock(restaurantId: string) {
    const ings = await prisma.ingredient.findMany({
      where: { restaurantId, active: true },
      include: { supplier: true, category: true }
    });
    return ings
      .filter(i => i.currentStock <= i.criticalStock)
      .map(i => ({
        ...i,
        suggestedOrder: Math.max(0, i.optimalStock - i.currentStock)
      }));
  }

  /**
   * Detect lots expiring soon.
   */
  async getExpiringLots(restaurantId: string, daysAhead: number = 5) {
    const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const lots = await prisma.expirationLot.findMany({
      where: {
        status: "ACTIVE",
        qtyRemaining: { gt: 0 },
        expirationDate: { lte: cutoff },
        ingredient: { restaurantId }
      },
      include: { ingredient: { include: { category: true } } },
      orderBy: { expirationDate: "asc" }
    });
    return lots.map(l => ({
      ...l,
      daysToExpire: Math.ceil((l.expirationDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      valueCents: Math.round(l.qtyRemaining * l.unitCostCents)
    }));
  }
}

export const inventoryService = new InventoryService();
