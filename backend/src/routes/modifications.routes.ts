import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { sockets } from "../sockets/index.js";

export const modRoutes = Router();

// Cliente solicita modificación de un item ya pedido
const requestSchema = z.object({
  reason: z.enum(["CANCEL", "QTY", "INGREDIENTS", "COOKING", "SWAP", "OTHER"]),
  note: z.string().optional()
});

modRoutes.post(
  "/orders/:orderId/items/:itemId/modifications",
  asyncHandler(async (req, res) => {
    const { reason, note } = requestSchema.parse(req.body);
    const item = await prisma.orderItem.findUnique({
      where: { id: req.params.itemId },
      include: { order: { include: { restaurant: true, table: true } } }
    });
    if (!item || item.orderId !== req.params.orderId) throw new HttpError(404, "not_found");
    if (item.kitchenStatus === "SERVED" || item.kitchenStatus === "CANCELLED") {
      throw new HttpError(409, "too_late", "El plato ya fue servido o cancelado");
    }

    const mod = await prisma.modificationRequest.create({
      data: { orderItemId: item.id, reason, note, status: "PENDING" }
    });

    // Notify kitchen + assigned waiter
    sockets.toRole(item.order.restaurantId, "KITCHEN", "modification:requested", { mod, orderId: item.orderId, mesa: item.order.table.number });
    if (item.order.serverId) {
      sockets.toWaiter(item.order.restaurantId, item.order.serverId, "modification:requested", { mod, orderId: item.orderId });
    }

    res.status(201).json(mod);
  })
);

// Cocina/mozo resuelve la modificación
const resolveSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
  kitchenNote: z.string().optional()
});

modRoutes.patch(
  "/modifications/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const { status, kitchenNote } = resolveSchema.parse(req.body);
    const mod = await prisma.modificationRequest.update({
      where: { id: req.params.id },
      data: { status, kitchenNote, resolvedAt: new Date() },
      include: { orderItem: { include: { order: true } } }
    });

    // If accepted and reason was CANCEL, cancel the item
    if (status === "ACCEPTED" && mod.reason === "CANCEL") {
      await prisma.orderItem.update({
        where: { id: mod.orderItemId },
        data: { kitchenStatus: "CANCELLED" }
      });
    }

    sockets.toOrder(mod.orderItem.order.restaurantId, mod.orderItem.orderId, "modification:resolved", mod);
    if (mod.orderItem.order.serverId) {
      sockets.toWaiter(mod.orderItem.order.restaurantId, mod.orderItem.order.serverId, "modification:resolved", mod);
    }

    res.json(mod);
  })
);

// List pending modifications for kitchen
modRoutes.get(
  "/modifications/pending",
  authRequired,
  asyncHandler(async (req, res) => {
    const mods = await prisma.modificationRequest.findMany({
      where: {
        status: "PENDING",
        orderItem: { order: { restaurantId: req.user!.restaurantId } }
      },
      include: { orderItem: { include: { menuItem: true, order: { include: { table: true } } } } },
      orderBy: { createdAt: "asc" }
    });
    res.json(mods);
  })
);
