/**
 * MesaSmart · Engagement & Quality
 * ─────────────────────────────────
 * Agrupa: pairings (sugerencias menú), upsell events (tracking conversión),
 * prep-time (analytics + metas), NPS (encuestas), reviews (Google externo)
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";

export const engagementRoutes = Router();

// ═══════════════════════════════════════════════════════════
//                        PAIRINGS · sugerencias por plato
// ═══════════════════════════════════════════════════════════

// GET /api/engagement/pairings/suggest?items=id1,id2
// Devuelve top sugerencias para un set de items en el carrito del mozo
engagementRoutes.get(
  "/pairings/suggest",
  authRequired,
  asyncHandler(async (req, res) => {
    const items = String(req.query.items || "").split(",").filter(Boolean);
    if (items.length === 0) return res.json([]);

    const pairings = await prisma.menuPairing.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        active: true,
        triggerItemId: { in: items }
      },
      orderBy: [{ priority: "desc" }, { conversionRate: "desc" }],
      take: 6
    });

    // Necesitamos los datos del menu item sugerido
    const suggestedIds = pairings.map(p => p.suggestedItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: suggestedIds } }
    });

    const enriched = pairings.map(p => ({
      ...p,
      suggested: menuItems.find(m => m.id === p.suggestedItemId)
    })).filter(p => p.suggested && p.suggested.available);

    res.json(enriched);
  })
);

// GET /api/engagement/pairings — admin list
engagementRoutes.get(
  "/pairings",
  authRequired,
  asyncHandler(async (req, res) => {
    const pairings = await prisma.menuPairing.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: { conversionRate: "desc" }
    });
    res.json(pairings);
  })
);

// POST /api/engagement/pairings — crear
const createPairingSchema = z.object({
  triggerItemId: z.string(),
  suggestedItemId: z.string(),
  pairingType: z.enum(["BEVERAGE", "DESSERT", "SIDE", "EXTRA"]),
  priority: z.number().int().min(0).max(10).default(5),
  message: z.string().max(160).optional()
});

engagementRoutes.post(
  "/pairings",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createPairingSchema.parse(req.body);
    const pairing = await prisma.menuPairing.create({
      data: { ...data, restaurantId: req.user!.restaurantId }
    });
    res.status(201).json(pairing);
  })
);

// ═══════════════════════════════════════════════════════════
//                  UPSELL EVENTS · tracking conversión
// ═══════════════════════════════════════════════════════════

// POST /api/engagement/upsell — el mozo registra que mostró sugerencia
const showUpsellSchema = z.object({
  pairingId: z.string().optional(),
  triggerItemId: z.string().optional(),
  suggestedItemId: z.string(),
  orderId: z.string().optional(),
  customerId: z.string().optional()
});

engagementRoutes.post(
  "/upsell",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = showUpsellSchema.parse(req.body);
    const event = await prisma.upsellEvent.create({
      data: {
        ...data,
        restaurantId: req.user!.restaurantId,
        waiterId: req.user!.userId,
        outcome: "PENDING"
      }
    });

    // Incrementa contador en el pairing
    if (data.pairingId) {
      await prisma.menuPairing.update({
        where: { id: data.pairingId },
        data: { totalShown: { increment: 1 } }
      });
    }

    res.status(201).json(event);
  })
);

// PATCH /api/engagement/upsell/:id — actualizar outcome
const upsellOutcomeSchema = z.object({
  outcome: z.enum(["ACCEPTED", "REJECTED", "IGNORED"]),
  acceptedQty: z.number().int().min(0).optional(),
  acceptedRevenueCents: z.number().int().min(0).optional()
});

engagementRoutes.patch(
  "/upsell/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = upsellOutcomeSchema.parse(req.body);
    const event = await prisma.upsellEvent.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId }
    });
    if (!event) throw new HttpError(404, "event_not_found");

    const updated = await prisma.upsellEvent.update({
      where: { id: event.id },
      data: { ...data, outcomeAt: new Date() }
    });

    // Recompute conversion rate del pairing
    if (event.pairingId && data.outcome === "ACCEPTED") {
      await prisma.menuPairing.update({
        where: { id: event.pairingId },
        data: { totalAccepted: { increment: 1 } }
      });
      const p = await prisma.menuPairing.findUnique({ where: { id: event.pairingId } });
      if (p && p.totalShown > 0) {
        await prisma.menuPairing.update({
          where: { id: p.id },
          data: { conversionRate: p.totalAccepted / p.totalShown }
        });
      }
    }

    res.json(updated);
  })
);

// GET /api/engagement/waiter-performance · métricas por mozo (admin)
engagementRoutes.get(
  "/waiter-performance",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const waiters = await prisma.user.findMany({
      where: { restaurantId, role: "WAITER", active: true }
    });

    const performance = await Promise.all(waiters.map(async (w) => {
      // Upsells del último mes
      const events = await prisma.upsellEvent.findMany({
        where: { restaurantId, waiterId: w.id, shownAt: { gte: since } }
      });
      const shown = events.length;
      const accepted = events.filter(e => e.outcome === "ACCEPTED").length;
      const conversion = shown > 0 ? accepted / shown : 0;
      const revenueGenerated = events
        .filter(e => e.outcome === "ACCEPTED")
        .reduce((s, e) => s + e.acceptedRevenueCents, 0);

      // Órdenes servidas y ticket promedio
      const orders = await prisma.order.findMany({
        where: {
          restaurantId,
          serverId: w.id,
          status: "PAID",
          paidAt: { gte: since }
        }
      });
      const totalRevenue = orders.reduce((s, o) => s + o.totalCents, 0);
      const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;
      const tipRevenue = orders.reduce((s, o) => s + o.tipCents, 0);

      // NPS del mozo
      const npsResp = await prisma.nPSResponse.findMany({
        where: { restaurantId, waiterId: w.id, respondedAt: { gte: since } }
      });
      const promoters = npsResp.filter(r => r.category === "PROMOTER").length;
      const detractors = npsResp.filter(r => r.category === "DETRACTOR").length;
      const npsScore = npsResp.length > 0
        ? Math.round(((promoters - detractors) / npsResp.length) * 100)
        : null;

      return {
        userId: w.id,
        name: w.name,
        position: w.position,
        upsellShown: shown,
        upsellAccepted: accepted,
        conversionRate: conversion,
        revenueGeneratedCents: revenueGenerated,
        ordersServed: orders.length,
        totalRevenueCents: totalRevenue,
        avgTicketCents: Math.round(avgTicket),
        tipRevenueCents: tipRevenue,
        npsResponses: npsResp.length,
        npsScore
      };
    }));

    res.json(performance);
  })
);

// ═══════════════════════════════════════════════════════════
//                  PREP TIME · métricas y metas
// ═══════════════════════════════════════════════════════════

// GET /api/engagement/prep-time · analytics de tiempos de preparación
engagementRoutes.get(
  "/prep-time",
  authRequired,
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // OrderItems con timestamps preparingAt y readyAt completos
    const items = await prisma.orderItem.findMany({
      where: {
        order: { restaurantId },
        preparingAt: { not: null },
        readyAt: { not: null },
        receivedAt: { gte: since }
      },
      select: {
        menuItemId: true,
        preparingAt: true,
        readyAt: true,
        menuItem: { select: { id: true, name: true, kitchenStation: true } }
      }
    });

    // Agrupar por (menuItemId, station)
    const grouped = new Map<string, { name: string; station: string; samples: number[] }>();
    for (const it of items) {
      if (!it.preparingAt || !it.readyAt) continue;
      const minutes = (it.readyAt.getTime() - it.preparingAt.getTime()) / 60000;
      const key = `${it.menuItem.id}|${it.menuItem.kitchenStation}`;
      const g = grouped.get(key) || {
        name: it.menuItem.name,
        station: it.menuItem.kitchenStation,
        samples: []
      };
      g.samples.push(minutes);
      grouped.set(key, g);
    }

    // Computar percentiles
    const targets = await prisma.prepTimeTarget.findMany({ where: { restaurantId } });
    const targetMap = new Map(targets.map(t => [`${t.menuItemId}|${t.station}`, t]));

    const result = Array.from(grouped.entries()).map(([key, g]) => {
      const [menuItemId] = key.split("|");
      const sorted = g.samples.slice().sort((a, b) => a - b);
      const p = (k: number) => sorted[Math.min(Math.floor(sorted.length * k), sorted.length - 1)] || 0;
      const avg = sorted.reduce((s, n) => s + n, 0) / sorted.length;
      const target = targetMap.get(key);
      const hitRate = target
        ? sorted.filter(s => s <= target.targetMinutes).length / sorted.length
        : null;

      return {
        menuItemId,
        name: g.name,
        station: g.station,
        samples: g.samples.length,
        avgMinutes: Math.round(avg * 10) / 10,
        p50: Math.round(p(0.5) * 10) / 10,
        p75: Math.round(p(0.75) * 10) / 10,
        p95: Math.round(p(0.95) * 10) / 10,
        targetMinutes: target?.targetMinutes,
        warningMinutes: target?.warningMinutes,
        criticalMinutes: target?.criticalMinutes,
        hitRatePct: hitRate !== null ? Math.round(hitRate * 100) : null
      };
    }).sort((a, b) => b.samples - a.samples);

    res.json(result);
  })
);

// PUT /api/engagement/prep-time/target — definir/actualizar meta
const upsertTargetSchema = z.object({
  menuItemId: z.string(),
  station: z.string(),
  targetMinutes: z.number().int().min(1).max(120),
  warningMinutes: z.number().int().min(1).optional(),
  criticalMinutes: z.number().int().min(1).optional()
});

engagementRoutes.put(
  "/prep-time/target",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = upsertTargetSchema.parse(req.body);
    const target = await prisma.prepTimeTarget.upsert({
      where: {
        restaurantId_menuItemId_station: {
          restaurantId: req.user!.restaurantId,
          menuItemId: data.menuItemId,
          station: data.station
        }
      },
      create: {
        restaurantId: req.user!.restaurantId,
        ...data,
        warningMinutes: data.warningMinutes || Math.round(data.targetMinutes * 1.2),
        criticalMinutes: data.criticalMinutes || Math.round(data.targetMinutes * 1.5)
      },
      update: data
    });
    res.json(target);
  })
);

// ═══════════════════════════════════════════════════════════
//                          NPS · encuestas
// ═══════════════════════════════════════════════════════════

const submitNpsSchema = z.object({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  waiterId: z.string().optional(),
  npsScore: z.number().int().min(0).max(10),
  foodScore: z.number().int().min(1).max(5).optional(),
  serviceScore: z.number().int().min(1).max(5).optional(),
  ambienceScore: z.number().int().min(1).max(5).optional(),
  speedScore: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
  source: z.enum(["TABLET", "EMAIL", "WHATSAPP", "QR"]).default("TABLET")
});

// POST sin auth — el cliente responde desde su tablet
engagementRoutes.post(
  "/nps/public",
  asyncHandler(async (req, res) => {
    const data = submitNpsSchema.parse(req.body);
    const restaurantId = String(req.body.restaurantId || "");
    if (!restaurantId) throw new HttpError(400, "restaurant_required");

    const category = data.npsScore >= 9 ? "PROMOTER" : data.npsScore >= 7 ? "PASSIVE" : "DETRACTOR";
    const sentiment = data.comment
      ? (data.npsScore >= 7 ? "POSITIVE" : data.npsScore >= 5 ? "NEUTRAL" : "NEGATIVE")
      : null;

    const response = await prisma.nPSResponse.create({
      data: { restaurantId, ...data, category, sentiment }
    });
    res.status(201).json({ ok: true, id: response.id, category });
  })
);

// GET /api/engagement/nps · score y tendencia
engagementRoutes.get(
  "/nps",
  authRequired,
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const responses = await prisma.nPSResponse.findMany({
      where: { restaurantId, respondedAt: { gte: since } },
      orderBy: { respondedAt: "desc" }
    });

    const total = responses.length;
    const promoters = responses.filter(r => r.category === "PROMOTER").length;
    const passives = responses.filter(r => r.category === "PASSIVE").length;
    const detractors = responses.filter(r => r.category === "DETRACTOR").length;
    const score = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;

    // Tendencia diaria (últimos 14 días)
    const trend: Array<{ date: string; score: number; count: number }> = [];
    for (let d = 13; d >= 0; d--) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      day.setHours(0, 0, 0, 0);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);

      const dayResp = responses.filter(r => r.respondedAt >= day && r.respondedAt < next);
      const dayProm = dayResp.filter(r => r.category === "PROMOTER").length;
      const dayDet = dayResp.filter(r => r.category === "DETRACTOR").length;
      trend.push({
        date: day.toISOString().slice(0, 10),
        score: dayResp.length > 0 ? Math.round(((dayProm - dayDet) / dayResp.length) * 100) : 0,
        count: dayResp.length
      });
    }

    // Subscores promedio
    const avg = (key: "foodScore" | "serviceScore" | "ambienceScore" | "speedScore") => {
      const valid = responses.filter(r => r[key] !== null);
      if (valid.length === 0) return null;
      return valid.reduce((s, r) => s + (r[key] || 0), 0) / valid.length;
    };

    res.json({
      score,
      total,
      promoters,
      passives,
      detractors,
      promotersPct: total > 0 ? Math.round((promoters / total) * 100) : 0,
      detractorsPct: total > 0 ? Math.round((detractors / total) * 100) : 0,
      avgFood: avg("foodScore"),
      avgService: avg("serviceScore"),
      avgAmbience: avg("ambienceScore"),
      avgSpeed: avg("speedScore"),
      trend,
      recent: responses.slice(0, 20)
    });
  })
);

// ═══════════════════════════════════════════════════════════
//                  EXTERNAL REVIEWS (Google/TripAdvisor)
// ═══════════════════════════════════════════════════════════

engagementRoutes.get(
  "/reviews",
  authRequired,
  asyncHandler(async (req, res) => {
    const reviews = await prisma.externalReview.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: { reviewedAt: "desc" },
      take: 50
    });
    const stats = await prisma.externalReview.groupBy({
      by: ["source"],
      where: { restaurantId: req.user!.restaurantId },
      _avg: { rating: true },
      _count: true
    });
    res.json({ reviews, stats });
  })
);

// POST /api/engagement/reviews — manual import o webhook
const importReviewSchema = z.object({
  source: z.enum(["GOOGLE", "TRIPADVISOR", "YELP", "FACEBOOK", "OTHER"]),
  externalId: z.string().optional(),
  authorName: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().optional(),
  body: z.string().optional(),
  url: z.string().url().optional(),
  reviewedAt: z.string()
});

engagementRoutes.post(
  "/reviews",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = importReviewSchema.parse(req.body);
    const sentiment = data.rating >= 4 ? "POSITIVE" : data.rating >= 3 ? "NEUTRAL" : "NEGATIVE";
    const review = await prisma.externalReview.create({
      data: {
        restaurantId: req.user!.restaurantId,
        ...data,
        reviewedAt: new Date(data.reviewedAt),
        sentiment
      }
    });
    res.status(201).json(review);
  })
);
