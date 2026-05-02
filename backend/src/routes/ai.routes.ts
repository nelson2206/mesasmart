/**
 * AI Routes
 * ─────────────
 * Endpoints opcionales que aprovechan Claude API.
 * Si no hay API key configurada, devuelven 503 con `ai_disabled`.
 */

import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { aiService } from "../services/ai.service.js";
import { env } from "../config/env.js";
import { prisma } from "../prisma.js";
import { calcPriority } from "../services/priority.service.js";

export const aiRoutes = Router();

aiRoutes.get("/status", (_req, res) => {
  res.json({
    enabled: env.AI_FEATURES_ENABLED && Boolean(env.ANTHROPIC_API_KEY),
    model: env.ANTHROPIC_MODEL,
    features: ["explainPriority", "suggestSequence", "classifyComplaint", "translateMenu", "recommendForCustomer"]
  });
});

const requireAI = (_req: any, _res: any, next: any) => {
  if (!env.AI_FEATURES_ENABLED || !env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, "ai_disabled", "Configura ANTHROPIC_API_KEY y AI_FEATURES_ENABLED=true en .env");
  }
  next();
};

// Explicación de prioridad para un ticket
aiRoutes.get(
  "/explain-priority/:orderId",
  authRequired,
  requireAI,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { items: { include: { menuItem: true } }, table: true }
    });
    if (!order) throw new HttpError(404, "not_found");

    const priority = calcPriority(order);
    const explanation = await aiService.explainPriority({
      mesa: order.table.number,
      tier: priority.tier,
      score: priority.score,
      reasons: priority.reasons,
      items: order.items.map(i => ({
        name: i.menuItem.name,
        qty: i.qty,
        status: i.kitchenStatus,
        course: i.course
      }))
    });
    res.json({ explanation, priority });
  })
);

// Sugerir secuencia de preparación para una estación
aiRoutes.get(
  "/suggest-sequence",
  authRequired,
  requireAI,
  asyncHandler(async (req, res) => {
    const station = (req.query.station as string) ?? "brasa";
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        status: { in: ["OPEN", "KITCHEN"] }
      },
      include: { items: { include: { menuItem: true } }, table: true }
    });

    const pending = orders.flatMap(o =>
      o.items
        .filter(i => i.menuItem.kitchenStation === station && i.kitchenStatus !== "READY" && i.kitchenStatus !== "SERVED" && i.kitchenStatus !== "CANCELLED")
        .map(i => ({
          itemName: i.menuItem.name,
          orderId: o.id,
          mesa: o.table.number,
          prepMinutes: i.menuItem.prepMinutes,
          waitedMinutes: Math.floor((Date.now() - o.createdAt.getTime()) / 60000),
          priority: calcPriority(o)
        }))
    );

    const result = await aiService.suggestSequence({ station, pendingItems: pending });
    res.json({ pendingItems: pending, suggestion: result });
  })
);

// Clasificar queja
const classifySchema = z.object({ complaintText: z.string().min(1) });
aiRoutes.post(
  "/classify-complaint",
  authRequired,
  asyncHandler(async (req, res) => {
    const { complaintText } = classifySchema.parse(req.body);
    const result = await aiService.classifyComplaint(complaintText);
    res.json(result);
  })
);

// Traducir menú
const translateSchema = z.object({
  text: z.string(),
  lang: z.enum(["en", "pt", "fr"])
});
aiRoutes.post(
  "/translate",
  authRequired,
  requireAI,
  asyncHandler(async (req, res) => {
    const { text, lang } = translateSchema.parse(req.body);
    const result = await aiService.translateMenuText(text, lang);
    res.json({ translation: result });
  })
);

// Recomendación para cliente
const recoSchema = z.object({
  cartItemNames: z.array(z.string()).min(1)
});
aiRoutes.post(
  "/recommend",
  asyncHandler(async (req, res) => {
    const { cartItemNames } = recoSchema.parse(req.body);
    const restaurantId = (req.query.restaurantId as string) ?? req.user?.restaurantId;
    if (!restaurantId) throw new HttpError(400, "missing_restaurant");

    const allItems = await prisma.menuItem.findMany({
      where: { available: true, category: { restaurantId } },
      select: { name: true, description: true }
    });

    const reco = await aiService.recommendForCustomer({ cartItems: cartItemNames, allItems });
    res.json({ recommendation: reco });
  })
);
