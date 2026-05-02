import { Router } from "express";
import { prisma } from "../prisma.js";
import { authRequired } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { sockets } from "../sockets/index.js";

export const callRoutes = Router();

callRoutes.get(
  "/active",
  authRequired,
  asyncHandler(async (req, res) => {
    const calls = await prisma.call.findMany({
      where: {
        status: "PENDING",
        table: { restaurantId: req.user!.restaurantId }
      },
      include: { table: { select: { number: true, zone: true } } },
      orderBy: { createdAt: "asc" }
    });
    res.json(calls);
  })
);

callRoutes.patch(
  "/:id/resolve",
  authRequired,
  asyncHandler(async (req, res) => {
    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: "RESOLVED",
        resolvedById: req.user!.userId,
        resolvedAt: new Date()
      },
      include: { table: true }
    });
    sockets.toRestaurant(call.table.restaurantId, "call:resolved", { callId: call.id });
    res.json(call);
  })
);
