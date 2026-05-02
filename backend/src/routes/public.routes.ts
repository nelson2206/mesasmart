/**
 * Rutas públicas (sin auth) para el cliente en la mesa.
 * El cliente accede vía QR token único de la mesa.
 *
 * Flujo:
 *   1. Cliente escanea QR de la mesa → tiene qrToken
 *   2. GET /api/public/session/:qrToken → recibe restaurant + table + menu
 *   3. POST /api/public/orders → crea pedido pasando qrToken
 *   4. GET /api/public/orders/:id → consulta estado
 *   5. POST /api/public/orders/:id/modifications → solicita cambio
 *   6. POST /api/public/calls → llama al mozo
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { sockets } from "../sockets/index.js";
import { calcTaxBreakdown } from "../utils/money.js";

export const publicRoutes = Router();

/**
 * Sesión completa: identifica mesa, devuelve restaurante + menú listo para cargar.
 * Si no se pasa qrToken, devuelve la primera mesa libre del primer restaurante (modo demo).
 */
publicRoutes.get(
  "/session/:qrToken?",
  asyncHandler(async (req, res) => {
    let table;
    if (req.params.qrToken && req.params.qrToken !== "demo") {
      table = await prisma.table.findUnique({
        where: { qrToken: req.params.qrToken },
        include: { restaurant: true }
      });
    } else {
      // Demo mode: primera mesa del primer restaurante activo
      table = await prisma.table.findFirst({
        where: { active: true, restaurant: { active: true } },
        include: { restaurant: true },
        orderBy: { number: "asc" }
      });
    }

    if (!table) throw new HttpError(404, "table_not_found");

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: table.restaurantId, active: true },
      orderBy: { displayOrder: "asc" },
      include: {
        items: {
          where: { available: true },
          orderBy: { name: "asc" }
        }
      }
    });

    res.json({
      restaurant: {
        id: table.restaurant.id,
        name: table.restaurant.name,
        ruc: table.restaurant.ruc,
        address: table.restaurant.address,
        taxRate: table.restaurant.taxRate,
        tipDefaultPct: table.restaurant.tipDefaultPct
      },
      table: {
        id: table.id,
        number: table.number,
        qrToken: table.qrToken,
        seats: table.seats,
        zone: table.zone
      },
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        displayOrder: c.displayOrder,
        items: c.items.map(it => ({
          ...it,
          tags: JSON.parse(it.tags),
          priceSoles: it.priceCents / 100
        }))
      }))
    });
  })
);

/**
 * Crea pedido público pasando qrToken como auth.
 */
const createOrderSchema = z.object({
  qrToken: z.string(),
  partySize: z.number().int().min(1).default(1),
  items: z.array(z.object({
    menuItemId: z.string(),
    qty: z.number().int().min(1),
    notes: z.string().optional(),
    course: z.enum(["DRINKS", "STARTER", "MAIN", "SIDE", "DESSERT"]).default("MAIN")
  })).min(1)
});

publicRoutes.post(
  "/orders",
  asyncHandler(async (req, res) => {
    const data = createOrderSchema.parse(req.body);
    const table = await prisma.table.findUnique({
      where: { qrToken: data.qrToken },
      include: { restaurant: true }
    });
    if (!table) throw new HttpError(404, "invalid_qr");

    const items = await prisma.menuItem.findMany({
      where: { id: { in: data.items.map(i => i.menuItemId) } }
    });
    const itemMap = new Map(items.map(i => [i.id, i]));

    const order = await prisma.order.create({
      data: {
        restaurantId: table.restaurantId,
        tableId: table.id,
        partySize: data.partySize,
        status: "OPEN",
        items: {
          create: data.items.map(i => {
            const m = itemMap.get(i.menuItemId);
            if (!m) throw new HttpError(400, "invalid_item");
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
        items: { include: { menuItem: { select: { name: true, kitchenStation: true, imageUrl: true, priceCents: true } } } },
        table: true
      }
    });

    // Update table to OCCUPIED
    if (table.status === "FREE") {
      await prisma.table.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });
    }

    // Notify kitchen, admin, waiters
    sockets.toRole(table.restaurantId, "KITCHEN", "order:created", order);
    sockets.toRole(table.restaurantId, "ADMIN", "order:created", order);
    sockets.toRole(table.restaurantId, "WAITER", "order:created", order);

    res.status(201).json(order);
  })
);

/**
 * Consulta estado de orden por ID + qrToken (validación).
 */
publicRoutes.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const qrToken = req.query.qrToken as string;
    if (!qrToken) throw new HttpError(400, "missing_qr");

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { menuItem: true, modifications: { where: { status: { in: ["PENDING", "ACCEPTED", "REJECTED"] } } } } },
        table: true,
        comprobante: true,
        payment: true
      }
    });
    if (!order) throw new HttpError(404, "not_found");
    if (order.table.qrToken !== qrToken) throw new HttpError(403, "wrong_table");

    res.json(order);
  })
);

/**
 * Cliente pide modificación de un item.
 */
const modSchema = z.object({
  qrToken: z.string(),
  reason: z.enum(["CANCEL", "QTY", "INGREDIENTS", "COOKING", "SWAP", "OTHER"]),
  note: z.string().optional()
});

publicRoutes.post(
  "/orders/:orderId/items/:itemId/modifications",
  asyncHandler(async (req, res) => {
    const data = modSchema.parse(req.body);
    const item = await prisma.orderItem.findUnique({
      where: { id: req.params.itemId },
      include: { order: { include: { table: true, restaurant: true } } }
    });
    if (!item || item.orderId !== req.params.orderId) throw new HttpError(404, "not_found");
    if (item.order.table.qrToken !== data.qrToken) throw new HttpError(403, "wrong_table");
    if (item.kitchenStatus === "SERVED" || item.kitchenStatus === "CANCELLED") {
      throw new HttpError(409, "too_late", "Plato ya servido o cancelado");
    }

    const mod = await prisma.modificationRequest.create({
      data: { orderItemId: item.id, reason: data.reason, note: data.note, status: "PENDING" }
    });

    sockets.toRole(item.order.restaurantId, "KITCHEN", "modification:requested", { mod, orderId: item.orderId, mesa: item.order.table.number });
    sockets.toRole(item.order.restaurantId, "WAITER", "modification:requested", { mod, orderId: item.orderId });

    res.status(201).json(mod);
  })
);

/**
 * Cliente llama al mozo.
 */
const callSchema = z.object({
  qrToken: z.string(),
  reason: z.string(),
  urgent: z.boolean().optional()
});

publicRoutes.post(
  "/calls",
  asyncHandler(async (req, res) => {
    const data = callSchema.parse(req.body);
    const table = await prisma.table.findUnique({ where: { qrToken: data.qrToken } });
    if (!table) throw new HttpError(404, "invalid_qr");

    const call = await prisma.call.create({
      data: { tableId: table.id, reason: data.reason, urgent: data.urgent ?? false }
    });

    sockets.toRole(table.restaurantId, "WAITER", "call:created", { callId: call.id, tableNumber: table.number, reason: data.reason });
    sockets.toRole(table.restaurantId, "ADMIN", "call:created", { callId: call.id, tableNumber: table.number, reason: data.reason });

    res.status(201).json(call);
  })
);

/**
 * Cliente cierra orden (pide la cuenta).
 */
const checkoutSchema = z.object({
  qrToken: z.string(),
  tipPct: z.number().min(0).max(0.5).default(0.10)
});

publicRoutes.post(
  "/orders/:id/checkout",
  asyncHandler(async (req, res) => {
    const { qrToken, tipPct } = checkoutSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, restaurant: true, table: true }
    });
    if (!order) throw new HttpError(404, "not_found");
    if (order.table.qrToken !== qrToken) throw new HttpError(403, "wrong_table");

    const subtotalCents = order.items.reduce((s, i) => s + i.priceCents * i.qty, 0);
    const breakdown = calcTaxBreakdown(subtotalCents, order.restaurant.taxRate);
    const tipCents = Math.round(subtotalCents * tipPct);
    const totalCents = subtotalCents + tipCents;

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "BILLING", subtotalCents, taxCents: breakdown.taxCents, tipCents, totalCents, tipPct }
    });

    await prisma.table.update({ where: { id: order.tableId }, data: { status: "BILLING" } });

    sockets.toRole(order.restaurantId, "ADMIN", "order:status", { orderId: order.id, status: "BILLING" });
    sockets.toRole(order.restaurantId, "WAITER", "order:status", { orderId: order.id, status: "BILLING" });

    res.json({
      ...updated,
      breakdown: { baseCents: breakdown.baseCents, igvCents: breakdown.taxCents, subtotalCents, tipCents, totalCents }
    });
  })
);
