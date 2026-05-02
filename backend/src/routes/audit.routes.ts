import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const auditRoutes = Router();

// ─── GET: List audit logs (filterable) ──────────────────────────
auditRoutes.get(
  "/",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const where: any = { restaurantId: req.user!.restaurantId };
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.entityId) where.entityId = req.query.entityId;
    if (req.query.action) where.action = req.query.action;
    if (req.query.userId) where.userId = req.query.userId;

    // Date range filter
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from as string);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to as string);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200
    });

    res.json(logs);
  })
);

// ─── GET: Audit log stats (for dashboard) ─────────────────────
auditRoutes.get(
  "/stats",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;

    // Last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalAdjustments,
      totalTransformations,
      totalReceipts,
      adjustmentsByUser,
      actionsBreakdown
    ] = await Promise.all([
      prisma.auditLog.count({
        where: { restaurantId, action: { contains: "ADJUSTMENT" }, createdAt: { gte: sevenDaysAgo } }
      }),
      prisma.auditLog.count({
        where: { restaurantId, action: "EXECUTE_TRANSFORMATION", createdAt: { gte: sevenDaysAgo } }
      }),
      prisma.auditLog.count({
        where: { restaurantId, action: "CONFIRM_GOODS_RECEIPT", createdAt: { gte: sevenDaysAgo } }
      }),
      prisma.auditLog.groupBy({
        by: ["userId"],
        where: { restaurantId, createdAt: { gte: sevenDaysAgo } },
        _count: true
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where: { restaurantId, createdAt: { gte: sevenDaysAgo } },
        _count: true
      })
    ]);

    res.json({
      period: "last_7_days",
      totalAdjustments,
      totalTransformations,
      totalReceipts,
      byUser: adjustmentsByUser.map(u => ({ userId: u.userId, count: u._count })),
      byAction: actionsBreakdown.map(a => ({ action: a.action, count: a._count }))
    });
  })
);
