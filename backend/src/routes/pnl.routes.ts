import { Router } from "express";
import { z } from "zod";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { pnlService } from "../services/pnl.service.js";

export const pnlRoutes = Router();

const pnlSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  groupBy: z.enum(["day", "waiter", "category", "menuItem", "hour"]).optional()
});

pnlRoutes.get(
  "/",
  authRequired,
  requireRole("ADMIN", "CASHIER"),
  asyncHandler(async (req, res) => {
    const params = pnlSchema.parse(req.query);
    const from = params.from ? new Date(params.from) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const to = params.to ? new Date(params.to) : new Date();
    const result = await pnlService.compute({
      restaurantId: req.user!.restaurantId,
      from,
      to,
      groupBy: params.groupBy
    });
    res.json({ from, to, ...result });
  })
);
