import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { sockets } from "../sockets/index.js";

export const tableRoutes = Router();

tableRoutes.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const where: any = { restaurantId: req.user!.restaurantId, active: true };
    if (req.query.zone) where.zone = req.query.zone;
    if (req.query.status) where.status = req.query.status;

    const tables = await prisma.table.findMany({
      where,
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: { status: { in: ["OPEN", "KITCHEN", "SERVED", "BILLING"] } },
          include: { server: { select: { name: true, avatarColor: true } } }
        }
      }
    });
    res.json(tables);
  })
);

tableRoutes.get(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          where: { status: { in: ["OPEN", "KITCHEN", "SERVED", "BILLING"] } },
          include: { items: true, server: true }
        }
      }
    });
    if (!table) throw new HttpError(404, "not_found");
    res.json(table);
  })
);

const patchSchema = z.object({
  status: z.enum(["FREE", "OCCUPIED", "BILLING", "CLEANING", "RESERVED", "BLOCKED"]).optional(),
  blocked: z.boolean().optional(),
  blockedReason: z.string().optional(),
  joinedWith: z.number().int().nullable().optional(),
  complaint: z.string().nullable().optional(),
  seats: z.number().int().min(1).max(20).optional()
});

tableRoutes.patch(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = patchSchema.parse(req.body);
    const updateData: any = { ...data };
    if (data.complaint) updateData.complaintAt = new Date();
    if (data.complaint === null) updateData.complaintAt = null;
    if (data.blocked) updateData.blockedBy = req.user!.userId;

    const before = await prisma.table.findUnique({ where: { id: req.params.id } });
    const table = await prisma.table.update({ where: { id: req.params.id }, data: updateData });

    // If joining tables, update partner table reciprocally
    if (data.joinedWith !== undefined) {
      if (data.joinedWith === null) {
        // Unjoin: also unjoin partner
        if (before?.joinedWith) {
          await prisma.table.updateMany({
            where: { restaurantId: req.user!.restaurantId, number: before.joinedWith },
            data: { joinedWith: null }
          });
        }
      } else {
        await prisma.table.updateMany({
          where: { restaurantId: req.user!.restaurantId, number: data.joinedWith },
          data: { joinedWith: table.number }
        });
      }
    }

    sockets.toRestaurant(req.user!.restaurantId, "table:updated", table);
    if (data.complaint) {
      sockets.toRole(req.user!.restaurantId, "KITCHEN", "table:complaint", { tableId: table.id, complaint: data.complaint });
      sockets.toRole(req.user!.restaurantId, "ADMIN", "table:complaint", { tableId: table.id, complaint: data.complaint });
    }

    res.json(table);
  })
);

// Call waiter
const callSchema = z.object({
  reason: z.string().min(1),
  urgent: z.boolean().optional()
});

tableRoutes.post(
  "/:id/call",
  asyncHandler(async (req, res) => {
    const { reason, urgent } = callSchema.parse(req.body);
    const table = await prisma.table.findUnique({ where: { id: req.params.id }, include: { orders: { where: { status: { in: ["OPEN", "KITCHEN"] } }, take: 1 } } });
    if (!table) throw new HttpError(404, "table_not_found");

    const call = await prisma.call.create({
      data: { tableId: table.id, reason, urgent: urgent ?? false }
    });

    // Push to assigned waiter (if any) + admin
    const assignedWaiter = table.orders[0]?.serverId;
    if (assignedWaiter) {
      sockets.toWaiter(table.restaurantId, assignedWaiter, "call:created", { callId: call.id, tableNumber: table.number, reason, urgent });
    }
    sockets.toRole(table.restaurantId, "ADMIN", "call:created", { callId: call.id, tableNumber: table.number, reason });
    sockets.toRole(table.restaurantId, "WAITER", "call:created", { callId: call.id, tableNumber: table.number, reason });

    res.status(201).json(call);
  })
);

// Find table by QR (public, used by cliente.html)
tableRoutes.get(
  "/qr/:token",
  asyncHandler(async (req, res) => {
    const table = await prisma.table.findUnique({
      where: { qrToken: req.params.token },
      include: { restaurant: { select: { id: true, name: true, ruc: true, address: true } } }
    });
    if (!table) throw new HttpError(404, "table_not_found");
    res.json({
      id: table.id,
      number: table.number,
      restaurant: table.restaurant
    });
  })
);
