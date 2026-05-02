import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const reportRoutes = Router();

reportRoutes.get(
  "/dashboard",
  authRequired,
  requireRole("ADMIN", "CASHIER"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [paidToday, paidYesterday, activeTables, openOrders, activeCalls] = await Promise.all([
      prisma.order.aggregate({
        where: { restaurantId, status: "PAID", paidAt: { gte: today } },
        _sum: { totalCents: true },
        _count: true,
        _avg: { totalCents: true }
      }),
      prisma.order.aggregate({
        where: { restaurantId, status: "PAID", paidAt: { gte: yesterday, lt: today } },
        _sum: { totalCents: true },
        _count: true,
        _avg: { totalCents: true }
      }),
      prisma.table.count({ where: { restaurantId, status: "OCCUPIED" } }),
      prisma.order.count({ where: { restaurantId, status: { in: ["OPEN", "KITCHEN", "SERVED"] } } }),
      prisma.call.count({ where: { table: { restaurantId }, status: "PENDING" } })
    ]);

    res.json({
      today: {
        sales: paidToday._sum.totalCents ?? 0,
        orders: paidToday._count,
        avgTicket: paidToday._avg.totalCents ?? 0
      },
      yesterday: {
        sales: paidYesterday._sum.totalCents ?? 0,
        orders: paidYesterday._count,
        avgTicket: paidYesterday._avg.totalCents ?? 0
      },
      now: {
        activeTables,
        openOrders,
        activeCalls
      }
    });
  })
);

const salesSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  groupBy: z.enum(["hour", "day"]).default("hour")
});

reportRoutes.get(
  "/sales",
  authRequired,
  requireRole("ADMIN", "CASHIER"),
  asyncHandler(async (req, res) => {
    const params = salesSchema.parse(req.query);
    const from = params.from ? new Date(params.from) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const to = params.to ? new Date(params.to) : new Date();

    const orders = await prisma.order.findMany({
      where: { restaurantId: req.user!.restaurantId, status: "PAID", paidAt: { gte: from, lte: to } },
      select: { paidAt: true, totalCents: true }
    });

    const buckets = new Map<string, { count: number; cents: number }>();
    for (const o of orders) {
      if (!o.paidAt) continue;
      const k =
        params.groupBy === "hour"
          ? `${o.paidAt.getHours()}h`
          : `${o.paidAt.getMonth() + 1}/${o.paidAt.getDate()}`;
      const cur = buckets.get(k) ?? { count: 0, cents: 0 };
      cur.count++;
      cur.cents += o.totalCents;
      buckets.set(k, cur);
    }

    res.json([...buckets.entries()].map(([k, v]) => ({ bucket: k, ...v })));
  })
);

reportRoutes.get(
  "/top-items",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 10);

    // Aggregate with raw groupBy
    const grouped = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        order: { restaurantId: req.user!.restaurantId, status: "PAID" }
      },
      _sum: { qty: true, priceCents: true },
      orderBy: { _sum: { qty: "desc" } },
      take: limit
    });

    const items = await prisma.menuItem.findMany({
      where: { id: { in: grouped.map(g => g.menuItemId) } },
      select: { id: true, name: true }
    });
    const map = new Map(items.map(i => [i.id, i.name]));

    res.json(grouped.map(g => ({
      menuItemId: g.menuItemId,
      name: map.get(g.menuItemId),
      qty: g._sum.qty ?? 0,
      revenueCents: g._sum.priceCents ?? 0
    })));
  })
);
