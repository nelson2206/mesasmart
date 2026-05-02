import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";

export const planRoutes = Router();

// ─── GET: Get current restaurant plan ────────────────────────────
planRoutes.get(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    let plan = await prisma.restaurantPlan.findUnique({
      where: { restaurantId: req.user!.restaurantId }
    });

    // Create default if missing (fallback for migration)
    if (!plan) {
      plan = await prisma.restaurantPlan.create({
        data: {
          restaurantId: req.user!.restaurantId,
          pos: true,
          inventory: false,
          transformations: false,
          multiLocation: false,
          pnl: false,
          campaigns: false,
          customerTablet: false,
          totem: false,
          ai: false
        }
      });
    }

    res.json(plan);
  })
);

// ─── PATCH: Update plan (admin only) ─────────────────────────────
const updatePlanSchema = z.object({
  pos: z.boolean().optional(),
  inventory: z.boolean().optional(),
  transformations: z.boolean().optional(),
  multiLocation: z.boolean().optional(),
  pnl: z.boolean().optional(),
  campaigns: z.boolean().optional(),
  customerTablet: z.boolean().optional(),
  totem: z.boolean().optional(),
  ai: z.boolean().optional()
});

planRoutes.patch(
  "/me",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updatePlanSchema.parse(req.body);

    let plan = await prisma.restaurantPlan.findUnique({
      where: { restaurantId: req.user!.restaurantId }
    });

    if (!plan) {
      throw new HttpError(404, "plan_not_found");
    }

    // Audit: log what changed
    const before = { ...plan };

    const updated = await prisma.restaurantPlan.update({
      where: { restaurantId: req.user!.restaurantId },
      data
    });

    // Find differences
    const changed = Object.keys(data).filter(k => before[k as keyof typeof before] !== data[k as keyof typeof data]);

    await prisma.auditLog.create({
      data: {
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        action: "UPDATE_PLAN",
        entityType: "RestaurantPlan",
        entityId: updated.id,
        before: JSON.stringify(before),
        after: JSON.stringify(updated),
        reason: `Modules changed: ${changed.join(", ")}`
      }
    });

    res.json(updated);
  })
);
