import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { sockets } from "../sockets/index.js";
import { calcPriority, refreshOrderPriority, topRecommendation } from "../services/priority.service.js";
import { aiService } from "../services/ai.service.js";
import { inventoryService } from "../services/inventory.service.js";
import { calcTaxBreakdown } from "../utils/money.js";

export const orderRoutes = Router();

// ─── List/Get ──────────────────────────────────
orderRoutes.get(
  "/active",
  authRequired,
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    const where: any = {
      restaurantId: req.user!.restaurantId,
      status: { in: role === "KITCHEN" ? ["OPEN", "KITCHEN"] : ["OPEN", "KITCHEN", "SERVED", "BILLING"] }
    };
    if (role === "WAITER") where.serverId = req.user!.userId;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        items: { include: { menuItem: { select: { name: true, kitchenStation: true } } } },
        table: { select: { number: true, zone: true } },
        server: { select: { name: true, avatarColor: true } }
      }
    });

    res.json(orders);
  })
);

orderRoutes.get(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { menuItem: true, modifications: true } },
        table: true,
        server: { select: { name: true, avatarColor: true } },
        comprobante: true,
        payment: true
      }
    });
    if (!order) throw new HttpError(404, "not_found");
    const priority = calcPriority(order);
    res.json({ ...order, priority });
  })
);

// ─── Create order ──────────────────────────────
const createSchema = z.object({
  tableId: z.string(),
  partySize: z.number().int().min(1).default(1),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        qty: z.number().int().min(1),
        notes: z.string().optional(),
        course: z.enum(["DRINKS", "STARTER", "MAIN", "SIDE", "DESSERT"]).default("MAIN")
      })
    )
    .min(1)
});

orderRoutes.post(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const items = await prisma.menuItem.findMany({
      where: { id: { in: data.items.map(i => i.menuItemId) } }
    });
    const itemMap = new Map(items.map(i => [i.id, i]));

    const order = await prisma.order.create({
      data: {
        restaurantId: req.user!.restaurantId,
        tableId: data.tableId,
        serverId: req.user!.role === "WAITER" ? req.user!.userId : null,
        partySize: data.partySize,
        status: "OPEN",
        items: {
          create: data.items.map(i => {
            const m = itemMap.get(i.menuItemId);
            if (!m) throw new HttpError(400, "invalid_item", `Menu item ${i.menuItemId} not found`);
            return {
              menuItemId: i.menuItemId,
              qty: i.qty,
              notes: i.notes,
              course: i.course,
              priceCents: m.priceCents
            };
          })
        }
      },
      include: {
        items: { include: { menuItem: { select: { name: true, kitchenStation: true } } } },
        table: true
      }
    });

    // Mark table as occupied
    await prisma.table.update({ where: { id: data.tableId }, data: { status: "OCCUPIED" } });

    // Notify
    sockets.toRole(req.user!.restaurantId, "KITCHEN", "order:created", order);
    sockets.toRole(req.user!.restaurantId, "ADMIN", "order:created", order);
    if (order.serverId) {
      sockets.toWaiter(req.user!.restaurantId, order.serverId, "order:created", order);
    }
    sockets.toTable(req.user!.restaurantId, order.table.number, "order:created", order);

    res.status(201).json(order);
  })
);

// ─── Update priority / complaint ──────────────────────────────
const patchSchema = z.object({
  priority: z.enum(["NORMAL", "HIGH", "VIP"]).optional(),
  vipNote: z.string().nullable().optional(),
  complaint: z.string().nullable().optional()
});

orderRoutes.patch(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = patchSchema.parse(req.body);
    const update: any = { ...data };
    if (data.complaint) update.complaintAt = new Date();
    if (data.complaint === null) update.complaintAt = null;

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: update,
      include: { items: { select: { course: true, kitchenStatus: true } } }
    });

    const priority = await refreshOrderPriority(order.id);

    sockets.toRole(order.restaurantId, "KITCHEN", "order:priority:changed", { orderId: order.id, priority });
    sockets.toRole(order.restaurantId, "ADMIN", "order:priority:changed", { orderId: order.id, priority });

    res.json({ ...order, priority });
  })
);

// ─── Advance kitchen status of an item ──────────────────────────────
const FLOW = ["RECEIVED", "PREPARING", "READY", "SERVED"] as const;

orderRoutes.post(
  "/:orderId/items/:itemId/advance",
  authRequired,
  asyncHandler(async (req, res) => {
    const item = await prisma.orderItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || item.orderId !== req.params.orderId) throw new HttpError(404, "not_found");

    const idx = FLOW.indexOf(item.kitchenStatus as any);
    if (idx >= FLOW.length - 1) throw new HttpError(400, "already_served");

    const next = FLOW[idx + 1];
    const ts = new Date();
    const tsField =
      next === "PREPARING" ? "preparingAt" :
      next === "READY" ? "readyAt" :
      next === "SERVED" ? "servedAt" : null;

    const updated = await prisma.orderItem.update({
      where: { id: item.id },
      data: { kitchenStatus: next, ...(tsField ? { [tsField]: ts } : {}) },
      include: { menuItem: { select: { name: true, kitchenStation: true } } }
    });

    // If first STARTER item is served, mark order.entradaServedAt for course optimization
    if (next === "SERVED" && updated.course === "STARTER") {
      await prisma.order.update({
        where: { id: req.params.orderId },
        data: { entradaServedAt: ts }
      });
    }

    // ─── ERP: deduct inventory when item is SERVED ───
    let inventoryWarnings: string[] = [];
    if (next === "SERVED") {
      const result = await inventoryService.deductForOrderItem({
        orderItemId: item.id,
        userId: req.user!.userId
      });
      inventoryWarnings = result.warnings;

      // Push warnings to admin if stock is critical
      if (inventoryWarnings.some(w => w.startsWith("CRITICO"))) {
        sockets.toRole(req.user!.restaurantId, "ADMIN", "inventory:critical", { warnings: inventoryWarnings, orderId: req.params.orderId });
      }
    }

    const priority = await refreshOrderPriority(req.params.orderId);

    sockets.toOrder(req.user!.restaurantId, req.params.orderId, "order:item:advanced", { itemId: item.id, status: next });
    sockets.toRole(req.user!.restaurantId, "KITCHEN", "order:item:advanced", { orderId: req.params.orderId, itemId: item.id, status: next });
    sockets.toRole(req.user!.restaurantId, "WAITER", "order:item:advanced", { orderId: req.params.orderId, itemId: item.id, status: next });

    res.json({ item: updated, priority, inventoryWarnings });
  })
);

// ─── Add items to existing order (second round) ──────────────────────────────
orderRoutes.post(
  "/:id/items",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = createSchema.partial({ tableId: true, partySize: true }).parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new HttpError(404, "not_found");

    const items = await prisma.menuItem.findMany({ where: { id: { in: data.items!.map(i => i.menuItemId) } } });
    const itemMap = new Map(items.map(i => [i.id, i]));

    const created = await Promise.all(
      data.items!.map(i => {
        const m = itemMap.get(i.menuItemId);
        if (!m) throw new HttpError(400, "invalid_item");
        return prisma.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: i.menuItemId,
            qty: i.qty,
            notes: i.notes,
            course: i.course,
            priceCents: m.priceCents
          }
        });
      })
    );

    sockets.toRole(order.restaurantId, "KITCHEN", "order:items:added", { orderId: order.id, items: created });
    res.status(201).json(created);
  })
);

// ─── Bump (mark all served, close kitchen phase) ──────────────────────────────
orderRoutes.post(
  "/:id/bump",
  authRequired,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "SERVED", servedAt: new Date() }
    });
    sockets.toRestaurant(order.restaurantId, "order:status", { orderId: order.id, status: "SERVED" });
    res.json(order);
  })
);

// ─── Checkout (calculate bill with tip) ──────────────────────────────
const checkoutSchema = z.object({ tipPct: z.number().min(0).max(0.5).default(0.10) });

orderRoutes.post(
  "/:id/checkout",
  authRequired,
  asyncHandler(async (req, res) => {
    const { tipPct } = checkoutSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, restaurant: true }
    });
    if (!order) throw new HttpError(404, "not_found");

    const subtotalCents = order.items.reduce(
      (s, i) => s + i.priceCents * i.qty,
      0
    );
    const breakdown = calcTaxBreakdown(subtotalCents, order.restaurant.taxRate);
    const tipCents = Math.round(subtotalCents * tipPct);
    const totalCents = subtotalCents + tipCents;

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "BILLING",
        subtotalCents,
        taxCents: breakdown.taxCents,
        tipCents,
        totalCents,
        tipPct
      }
    });

    sockets.toRole(order.restaurantId, "ADMIN", "order:status", { orderId: order.id, status: "BILLING" });
    res.json({
      ...updated,
      breakdown: {
        baseCents: breakdown.baseCents,
        igvCents: breakdown.taxCents,
        subtotalCents,
        tipCents,
        totalCents
      }
    });
  })
);

// ─── Smart Priority endpoints ──────────────────────────────
orderRoutes.get(
  "/:id/priority",
  authRequired,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { select: { course: true, kitchenStatus: true } } }
    });
    if (!order) throw new HttpError(404, "not_found");
    const result = calcPriority(order);

    // Optionally enrich with AI explanation if enabled
    let aiExplanation: string | null = null;
    if (req.query.explain === "true") {
      const fullOrder = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: { include: { menuItem: true } }, table: true }
      });
      if (fullOrder) {
        aiExplanation = await aiService.explainPriority({
          mesa: fullOrder.table.number,
          tier: result.tier,
          score: result.score,
          reasons: result.reasons,
          items: fullOrder.items.map(i => ({
            name: i.menuItem.name,
            qty: i.qty,
            status: i.kitchenStatus,
            course: i.course
          }))
        });
      }
    }

    res.json({ ...result, aiExplanation });
  })
);

orderRoutes.get(
  "/priority/recommendation",
  authRequired,
  asyncHandler(async (req, res) => {
    const top = await topRecommendation(req.user!.restaurantId);
    if (!top) return res.json(null);
    res.json({
      orderId: top.order.id,
      priority: top.priority,
      mesa: (top.order as any).table?.number
    });
  })
);
