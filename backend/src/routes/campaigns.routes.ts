import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { aiService } from "../services/ai.service.js";

export const campaignRoutes = Router();

// List campaigns by status
campaignRoutes.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const where: any = { restaurantId: req.user!.restaurantId };
    if (req.query.status) where.status = req.query.status;
    const items = await prisma.campaignSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json(items.map(c => ({
      ...c,
      targetItems: JSON.parse(c.targetItems),
      aiReasons: JSON.parse(c.aiReasons),
      performance: JSON.parse(c.performance)
    })));
  })
);

// Generate fresh campaign suggestions using AI
campaignRoutes.post(
  "/generate",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;

    // ── Build context for AI ──
    // 1. Low rotation menu items (sold < threshold in last 30 days)
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const sales = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: { order: { restaurantId, status: "PAID", paidAt: { gte: since } } },
      _sum: { qty: true }
    });
    const salesMap = new Map(sales.map(s => [s.menuItemId, s._sum.qty ?? 0]));

    const menuItems = await prisma.menuItem.findMany({
      where: { available: true, category: { restaurantId } }
    });

    const lowRotationItems = menuItems
      .map(m => {
        const sold = salesMap.get(m.id) ?? 0;
        // Compute approximate margin from recipe
        return { id: m.id, name: m.name, sold, marginPct: 65 }; // simplified
      })
      .filter(i => i.sold < 5)
      .slice(0, 8)
      .map(i => ({ menuItemId: i.id, name: i.name, soldLast30d: i.sold, marginPct: i.marginPct }));

    // 2. Expiring ingredients
    const expiringLots = await prisma.expirationLot.findMany({
      where: {
        status: "ACTIVE",
        qtyRemaining: { gt: 0 },
        expirationDate: { lte: new Date(Date.now() + 5 * 86400000) },
        ingredient: { restaurantId }
      },
      include: { ingredient: true },
      orderBy: { expirationDate: "asc" }
    });
    const expiringIngredients = expiringLots.map(l => ({
      name: l.ingredient.name,
      daysToExpire: Math.ceil((l.expirationDate.getTime() - Date.now()) / 86400000),
      qty: l.qtyRemaining,
      unit: l.ingredient.unit
    }));

    // 3. Off-hours (slowest 4 hours)
    const ordersByHour = await prisma.order.findMany({
      where: { restaurantId, status: "PAID", paidAt: { gte: since } },
      select: { paidAt: true }
    });
    const hourCount = new Map<number, number>();
    for (const o of ordersByHour) if (o.paidAt) hourCount.set(o.paidAt.getHours(), (hourCount.get(o.paidAt.getHours()) ?? 0) + 1);
    const avgPerHour = Array.from(hourCount.values()).reduce((s, n) => s + n, 0) / 24;
    const offHours = [...hourCount.entries()]
      .filter(([h, _]) => h >= 11 && h <= 23)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 4)
      .map(([h, c]) => ({ hour: `${h}:00`, ordersAvg: c, benchmarkAvg: Math.round(avgPerHour) }));

    // 4. Customer segments
    const customers = await prisma.customer.findMany({ where: { restaurantId } });
    const segments = {
      VIP: customers.filter(c => JSON.parse(c.tags).includes("VIP")),
      RIESGO_FUGA: customers.filter(c => JSON.parse(c.tags).includes("RIESGO_FUGA")),
      FRECUENTE: customers.filter(c => JSON.parse(c.tags).includes("FRECUENTE"))
    };
    const customerSegments = Object.entries(segments).map(([segment, list]) => ({
      segment,
      count: list.length,
      avgTicketCents: list.length > 0 ? Math.round(list.reduce((s, c) => s + c.avgTicketCents, 0) / list.length) : 0,
      lastVisitDays: list.length > 0 ? Math.round(list.reduce((s, c) => s + (Date.now() - c.lastVisitAt.getTime()) / 86400000, 0) / list.length) : 0
    }));

    // 5. Upcoming national dates (Peruvian)
    const nat = upcomingNationalDates();

    // 6. Top margin items (highest priced, most popular)
    const topMarginItems = menuItems
      .filter(m => m.popular || m.recommended)
      .slice(0, 5)
      .map(m => ({ menuItemId: m.id, name: m.name, marginPct: 70 }));

    const suggestions = await aiService.suggestCampaigns({
      lowRotationItems,
      expiringIngredients,
      offHours,
      customerSegments,
      upcomingNationalDates: nat,
      topMarginItems
    });

    if (!suggestions || suggestions.length === 0) {
      return res.json({ suggestions: [], message: "AI no devolvió sugerencias. Verifica AI_FEATURES_ENABLED y ANTHROPIC_API_KEY." });
    }

    const created = await Promise.all(
      suggestions.map(s =>
        prisma.campaignSuggestion.create({
          data: {
            restaurantId,
            title: s.title,
            hook: s.hook,
            body: s.body,
            type: s.type,
            rationale: s.rationale,
            targetItems: JSON.stringify(s.targetItems ?? []),
            targetAudience: s.targetAudience ?? "ALL",
            expectedRevenueLiftCents: s.expectedRevenueLiftCents ?? 0,
            expectedMarginImpact: s.expectedMarginImpact ?? 0,
            validFrom: s.validFrom ? new Date(s.validFrom) : null,
            validUntil: s.validUntil ? new Date(s.validUntil) : null,
            aiGenerated: true,
            aiReasons: JSON.stringify({ context: { lowRotationItems: lowRotationItems.length, expiringIngredients: expiringIngredients.length, offHours: offHours.length, segments: customerSegments } })
          }
        })
      )
    );

    res.json({ suggestions: created, context: { lowRotationItems, expiringIngredients, offHours, customerSegments, upcomingNationalDates: nat } });
  })
);

// Update campaign status (launch / archive / reject)
campaignRoutes.patch(
  "/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(["SUGGESTED", "ACTIVE", "ARCHIVED", "REJECTED", "COMPLETED"]) }).parse(req.body);
    const update: any = { status };
    if (status === "ACTIVE") update.launchedAt = new Date();
    if (status === "COMPLETED" || status === "ARCHIVED") update.endedAt = new Date();
    const campaign = await prisma.campaignSuggestion.update({ where: { id: req.params.id }, data: update });
    res.json(campaign);
  })
);

function upcomingNationalDates() {
  const now = new Date();
  const year = now.getFullYear();
  const dates = [
    { date: `${year}-02-01`, name: "Día del Pisco Sour (1er sábado feb)", relevance: "Promociones de coctelería peruana, maridaje" },
    { date: `${year}-05-12`, name: "Día de la Madre", relevance: "Menú especial, decoración, regalo" },
    { date: `${year}-06-16`, name: "Día del Padre", relevance: "Promociones para grupos familiares, parrillas" },
    { date: `${year}-07-21`, name: "Día del Pollo a la Brasa (3er domingo julio)", relevance: "Día más relevante para pollería · ofertas especiales" },
    { date: `${year}-07-28`, name: "Fiestas Patrias", relevance: "Decoración patriótica, menús criollos, chicha morada destacada" },
    { date: `${year}-10-31`, name: "Halloween / Día de la Canción Criolla", relevance: "Eventos temáticos, música" },
    { date: `${year}-12-24`, name: "Nochebuena", relevance: "Cenas familiares grandes" },
    { date: `${year}-12-31`, name: "Año Nuevo", relevance: "Cenas premium, paquetes" }
  ];
  return dates.filter(d => new Date(d.date).getTime() >= now.getTime() - 86400000).slice(0, 4);
}
