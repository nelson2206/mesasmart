/**
 * P&L Service
 * ─────────────
 * Profit & Loss agregado por dimensiones: día, mozo, restaurante, categoría.
 * Costo de mercadería vendido (COGS) se calcula desde InventoryMovement
 * con type = SALE_DEDUCT en el rango de fechas.
 */

import { prisma } from "../prisma.js";

export interface PnlInput {
  restaurantId: string;
  from: Date;
  to: Date;
  groupBy?: "day" | "waiter" | "category" | "menuItem" | "hour";
}

export interface PnlBucket {
  key: string;
  label: string;
  ordersCount: number;
  itemsSold: number;
  revenueCents: number;       // ventas (con IGV)
  netRevenueCents: number;    // sin IGV
  cogsCents: number;          // costo de mercadería
  grossProfitCents: number;   // net - cogs
  marginPct: number;          // gross / net
  tipsCents: number;
  avgTicketCents: number;
}

class PnlService {
  /**
   * Compute P&L for a given range, optionally grouped by dimension.
   */
  async compute(input: PnlInput): Promise<{ buckets: PnlBucket[]; total: PnlBucket }> {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: input.restaurantId,
        status: "PAID",
        paidAt: { gte: input.from, lte: input.to }
      },
      include: {
        items: { include: { menuItem: { include: { category: true } } } },
        server: { select: { id: true, name: true } }
      }
    });

    // Get all SALE_DEDUCT movements in range to compute COGS
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        type: "SALE_DEDUCT",
        createdAt: { gte: input.from, lte: input.to },
        ingredient: { restaurantId: input.restaurantId }
      }
    });

    // Index COGS by orderItemId
    const cogsByOrderItem = new Map<string, number>();
    for (const m of movements) {
      if (m.refType === "ORDER_ITEM" && m.refId) {
        const cur = cogsByOrderItem.get(m.refId) ?? 0;
        cogsByOrderItem.set(m.refId, cur + Math.abs(m.totalCostCents));
      }
    }

    const taxRate = 0.18;

    // Build buckets
    const buckets = new Map<string, PnlBucket>();
    const ensure = (key: string, label: string): PnlBucket => {
      if (!buckets.has(key)) {
        buckets.set(key, {
          key, label,
          ordersCount: 0, itemsSold: 0,
          revenueCents: 0, netRevenueCents: 0,
          cogsCents: 0, grossProfitCents: 0,
          marginPct: 0, tipsCents: 0, avgTicketCents: 0
        });
      }
      return buckets.get(key)!;
    };

    for (const o of orders) {
      const orderCogs = o.items.reduce((s, i) => s + (cogsByOrderItem.get(i.id) ?? 0), 0);
      const orderItemCount = o.items.reduce((s, i) => s + i.qty, 0);

      let key: string, label: string;
      if (input.groupBy === "day") {
        key = o.paidAt!.toISOString().slice(0, 10);
        label = key;
      } else if (input.groupBy === "waiter") {
        key = o.server?.id ?? "sin_mozo";
        label = o.server?.name ?? "Sin asignar";
      } else if (input.groupBy === "hour") {
        key = String(o.paidAt!.getHours()).padStart(2, "0") + ":00";
        label = key;
      } else if (input.groupBy === "category") {
        // Per item, distribute revenue
        for (const it of o.items) {
          const k = it.menuItem.category.id;
          const lbl = it.menuItem.category.name;
          const b = ensure(k, lbl);
          const itemRevenue = it.priceCents * it.qty;
          b.revenueCents += itemRevenue;
          b.cogsCents += cogsByOrderItem.get(it.id) ?? 0;
          b.itemsSold += it.qty;
        }
        // Skip the per-order accumulation below for category
        continue;
      } else if (input.groupBy === "menuItem") {
        for (const it of o.items) {
          const k = it.menuItemId;
          const lbl = it.menuItem.name;
          const b = ensure(k, lbl);
          b.revenueCents += it.priceCents * it.qty;
          b.cogsCents += cogsByOrderItem.get(it.id) ?? 0;
          b.itemsSold += it.qty;
        }
        continue;
      } else {
        key = "total";
        label = "Total";
      }

      const b = ensure(key, label);
      b.ordersCount += 1;
      b.itemsSold += orderItemCount;
      b.revenueCents += o.totalCents;
      b.tipsCents += o.tipCents;
      b.cogsCents += orderCogs;
    }

    // Finalize derived fields
    for (const b of buckets.values()) {
      b.netRevenueCents = Math.round(b.revenueCents / (1 + taxRate));
      b.grossProfitCents = b.netRevenueCents - b.cogsCents;
      b.marginPct = b.netRevenueCents > 0 ? (b.grossProfitCents / b.netRevenueCents) * 100 : 0;
      b.avgTicketCents = b.ordersCount > 0 ? Math.round(b.revenueCents / b.ordersCount) : 0;
    }

    // Total roll-up
    const total: PnlBucket = {
      key: "total", label: "Total",
      ordersCount: 0, itemsSold: 0, revenueCents: 0, netRevenueCents: 0,
      cogsCents: 0, grossProfitCents: 0, marginPct: 0, tipsCents: 0, avgTicketCents: 0
    };
    for (const b of buckets.values()) {
      total.ordersCount += b.ordersCount;
      total.itemsSold += b.itemsSold;
      total.revenueCents += b.revenueCents;
      total.cogsCents += b.cogsCents;
      total.tipsCents += b.tipsCents;
    }
    total.netRevenueCents = Math.round(total.revenueCents / (1 + taxRate));
    total.grossProfitCents = total.netRevenueCents - total.cogsCents;
    total.marginPct = total.netRevenueCents > 0 ? (total.grossProfitCents / total.netRevenueCents) * 100 : 0;
    total.avgTicketCents = total.ordersCount > 0 ? Math.round(total.revenueCents / total.ordersCount) : 0;

    const sortedBuckets = [...buckets.values()].sort((a, b) => b.revenueCents - a.revenueCents);
    return { buckets: sortedBuckets, total };
  }
}

export const pnlService = new PnlService();
