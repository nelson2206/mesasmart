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

// ════════════════════════════════════════════════════════════
//        IDENTIFICACIÓN DE CLIENTE RECURRENTE + REWARDS
// ════════════════════════════════════════════════════════════

/**
 * Tiers de cliente recurrente con sus rewards automáticos.
 * Se calcula on-the-fly en base a totalVisits + totalSpentCents.
 */
function computeCustomerTier(visits: number, totalSpentCents: number) {
  if (visits >= 20 || totalSpentCents >= 200000) {
    return {
      tier: "VIP",
      label: "Cliente VIP",
      icon: "👑",
      color: "#C8941F",
      reward: { type: "DISCOUNT_PCT", value: 15, label: "15% de descuento + bebida cortesía" }
    };
  }
  if (visits >= 10 || totalSpentCents >= 80000) {
    return {
      tier: "FREQUENT",
      label: "Cliente frecuente",
      icon: "⭐",
      color: "#A0322B",
      reward: { type: "DISCOUNT_PCT", value: 10, label: "10% de descuento de cortesía" }
    };
  }
  if (visits >= 3) {
    return {
      tier: "RETURNING",
      label: "Bienvenido de vuelta",
      icon: "🤝",
      color: "#2D7D5A",
      reward: { type: "FREE_DRINK", value: 1, label: "Chicha morada de cortesía" }
    };
  }
  return {
    tier: "NEW",
    label: "Primera visita",
    icon: "👋",
    color: "#6B5D52",
    reward: null
  };
}

/**
 * Identifica cliente por email, DNI o celular.
 * Si lo encuentra, devuelve historial + tier + reward.
 * Si no, sugiere registrarlo (opcional).
 */
const identifySchema = z
  .object({
    qrToken: z.string(),
    email: z.string().email().optional(),
    dni: z.string().regex(/^\d{8}$/).optional(),
    phone: z.string().min(6).optional(),
    name: z.string().optional()
  })
  .refine(d => d.email || d.dni || d.phone, { message: "Ingresa email, DNI o celular" });

publicRoutes.post(
  "/customer/identify",
  asyncHandler(async (req, res) => {
    const data = identifySchema.parse(req.body);
    const table = await prisma.table.findUnique({ where: { qrToken: data.qrToken } });
    if (!table) throw new HttpError(404, "invalid_qr");

    const filter: any = { restaurantId: table.restaurantId, OR: [] };
    if (data.email) filter.OR.push({ email: data.email });
    if (data.dni) filter.OR.push({ dni: data.dni });
    if (data.phone) filter.OR.push({ phone: data.phone });

    let customer = await prisma.customer.findFirst({ where: filter });

    // Si no existe, lo registramos como nuevo (NEW tier)
    if (!customer && (data.email || data.dni || data.phone)) {
      try {
        customer = await prisma.customer.create({
          data: {
            restaurantId: table.restaurantId,
            name: data.name || null,
            email: data.email || null,
            dni: data.dni || null,
            phone: data.phone || null,
            tags: JSON.stringify(["NUEVO"]),
            totalVisits: 1,
            totalSpentCents: 0,
            avgTicketCents: 0
          }
        });
      } catch (e: any) {
        // Si choca con unique de DNI por restaurante, busca de nuevo
        customer = await prisma.customer.findFirst({ where: filter });
      }
    }

    if (!customer) {
      return res.json({
        found: false,
        tier: computeCustomerTier(0, 0)
      });
    }

    const tier = computeCustomerTier(customer.totalVisits, customer.totalSpentCents);

    res.json({
      found: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        dni: customer.dni,
        phone: customer.phone,
        totalVisits: customer.totalVisits,
        totalSpentCents: customer.totalSpentCents,
        avgTicketCents: customer.avgTicketCents,
        lastVisitAt: customer.lastVisitAt,
        tags: JSON.parse(customer.tags || "[]"),
        preferences: JSON.parse(customer.preferences || "{}")
      },
      tier
    });
  })
);

/**
 * Registra una visita: incrementa totalVisits, actualiza lastVisitAt, recalcula avgTicket.
 * Llamado al cierre de orden con customerId.
 */
const registerVisitSchema = z.object({
  customerId: z.string(),
  orderId: z.string().optional(),
  spentCents: z.number().int().min(0).default(0)
});

publicRoutes.post(
  "/customer/register-visit",
  asyncHandler(async (req, res) => {
    const { customerId, orderId, spentCents } = registerVisitSchema.parse(req.body);
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new HttpError(404, "customer_not_found");

    const newTotalVisits = customer.totalVisits + 1;
    const newTotalSpent = customer.totalSpentCents + spentCents;
    const newAvg = Math.round(newTotalSpent / newTotalVisits);

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalVisits: newTotalVisits,
        totalSpentCents: newTotalSpent,
        avgTicketCents: newAvg,
        lastVisitAt: new Date()
      }
    });

    const tier = computeCustomerTier(newTotalVisits, newTotalSpent);
    res.json({ customer: updated, tier });
  })
);

/**
 * Aplica reward al cierre de cuenta: ajusta el descuento sobre la orden.
 * Permite que el cliente lo redima desde la pantalla de cliente.
 */
const applyRewardSchema = z.object({
  qrToken: z.string(),
  customerId: z.string(),
  orderId: z.string()
});

publicRoutes.post(
  "/customer/apply-reward",
  asyncHandler(async (req, res) => {
    const { qrToken, customerId, orderId } = applyRewardSchema.parse(req.body);
    const table = await prisma.table.findUnique({ where: { qrToken } });
    if (!table) throw new HttpError(404, "invalid_qr");

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new HttpError(404, "customer_not_found");

    const tier = computeCustomerTier(customer.totalVisits, customer.totalSpentCents);
    if (!tier.reward) {
      return res.json({ applied: false, reason: "no_reward_for_tier" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tableId !== table.id) throw new HttpError(403, "wrong_order");

    let discountCents = 0;
    if (tier.reward.type === "DISCOUNT_PCT") {
      discountCents = Math.round(order.subtotalCents * (tier.reward.value / 100));
      const newSubtotal = order.subtotalCents - discountCents;
      const newTotal = newSubtotal + order.tipCents;
      await prisma.order.update({
        where: { id: orderId },
        data: { subtotalCents: newSubtotal, totalCents: newTotal, vipNote: `Reward ${tier.tier}: ${tier.reward.label}` }
      });
    }

    res.json({
      applied: true,
      tier,
      discountCents,
      reward: tier.reward
    });
  })
);
