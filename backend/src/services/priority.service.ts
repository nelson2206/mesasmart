/**
 * Smart Priority Service
 * ──────────────────────
 * Composite scoring para priorizar tickets en cocina.
 * Función pura — testeable y portable. La cocina del cliente la duplica
 * en JS, este es el source of truth del backend.
 */

import { prisma } from "../prisma.js";

export type PriorityTier = "CRITICAL" | "HIGH" | "MEDIUM" | "NORMAL";

export interface PriorityReason {
  code: string;
  text: string;
  weight: number;
}

export interface PriorityResult {
  score: number;
  tier: PriorityTier;
  reasons: PriorityReason[];
}

interface OrderForPriority {
  id: string;
  createdAt: Date;
  priority: string; // NORMAL | HIGH | VIP
  vipNote: string | null;
  complaint: string | null;
  partySize: number;
  entradaServedAt: Date | null;
  items: {
    course: string;
    kitchenStatus: string;
  }[];
}

/**
 * Pesos tunables. En producción se podrían cargar desde tabla de configuración
 * por restaurante para experimentar A/B.
 */
export const WEIGHTS = {
  WAIT_PER_MIN: 8,
  WAIT_PENALTY_PER_MIN_OVER_10: 18,
  WAIT_PENALTY_THRESHOLD_MIN: 10,
  PRIORITY_VIP: 250,
  PRIORITY_HIGH: 120,
  COMPLAINT: 200,
  COURSE_LATE: 90,        // entrada hace >8 min y no hay main listo
  COURSE_PROACTIVE: 40,   // entrada hace >4 min, prepara main
  SMALL_PARTY_WAITING: 25,
  DRINKS_PENDING: 35,
  DRINKS_WAIT_THRESHOLD_MIN: 3
} as const;

export function calcPriority(order: OrderForPriority, nowMs: number = Date.now()): PriorityResult {
  const waitMin = (nowMs - order.createdAt.getTime()) / 60000;
  let score = 0;
  const reasons: PriorityReason[] = [];

  // 1. Wait time
  const linearWait = Math.min(WEIGHTS.WAIT_PENALTY_THRESHOLD_MIN * WEIGHTS.WAIT_PER_MIN, waitMin * WEIGHTS.WAIT_PER_MIN);
  const overWait = waitMin > WEIGHTS.WAIT_PENALTY_THRESHOLD_MIN
    ? (waitMin - WEIGHTS.WAIT_PENALTY_THRESHOLD_MIN) * WEIGHTS.WAIT_PENALTY_PER_MIN_OVER_10
    : 0;
  const waitScore = linearWait + overWait;
  score += waitScore;
  if (waitMin > 10) reasons.push({ code: "WAIT_LATE", text: `Atrasado ${Math.floor(waitMin)} min`, weight: Math.round(waitScore) });
  else if (waitMin > 5) reasons.push({ code: "WAIT_NORMAL", text: `${Math.floor(waitMin)} min en cola`, weight: Math.round(waitScore) });

  // 2. Manual priority override
  if (order.priority === "VIP") {
    score += WEIGHTS.PRIORITY_VIP;
    reasons.push({ code: "VIP", text: order.vipNote ?? "VIP", weight: WEIGHTS.PRIORITY_VIP });
  } else if (order.priority === "HIGH") {
    score += WEIGHTS.PRIORITY_HIGH;
    reasons.push({ code: "HIGH", text: "Prioridad alta", weight: WEIGHTS.PRIORITY_HIGH });
  }

  // 3. Complaint
  if (order.complaint) {
    score += WEIGHTS.COMPLAINT;
    reasons.push({ code: "COMPLAINT", text: `Queja: ${order.complaint}`, weight: WEIGHTS.COMPLAINT });
  }

  // 4. Course optimization (entrada → main)
  if (order.entradaServedAt) {
    const sinceEntrada = (nowMs - order.entradaServedAt.getTime()) / 60000;
    const hasPendingMain = order.items.some(i => i.course === "MAIN" && i.kitchenStatus !== "READY" && i.kitchenStatus !== "SERVED" && i.kitchenStatus !== "CANCELLED");
    if (sinceEntrada > 8 && hasPendingMain) {
      score += WEIGHTS.COURSE_LATE;
      reasons.push({ code: "COURSE_LATE", text: `Comió entrada hace ${Math.floor(sinceEntrada)} min · sirvele plato fuerte`, weight: WEIGHTS.COURSE_LATE });
    } else if (sinceEntrada > 4 && hasPendingMain) {
      score += WEIGHTS.COURSE_PROACTIVE;
      reasons.push({ code: "COURSE_PROACTIVE", text: "Entrada servida · prepara plato fuerte", weight: WEIGHTS.COURSE_PROACTIVE });
    }
  }

  // 5. Small party waiting
  if (order.partySize <= 2 && waitMin > 6) {
    score += WEIGHTS.SMALL_PARTY_WAITING;
    reasons.push({ code: "SMALL_PARTY", text: "Mesa pequeña esperando", weight: WEIGHTS.SMALL_PARTY_WAITING });
  }

  // 6. Drinks pending
  const drinksPending = order.items.filter(
    i => i.course === "DRINKS" && i.kitchenStatus !== "READY" && i.kitchenStatus !== "SERVED" && i.kitchenStatus !== "CANCELLED"
  ).length;
  if (drinksPending > 0 && waitMin > WEIGHTS.DRINKS_WAIT_THRESHOLD_MIN) {
    score += WEIGHTS.DRINKS_PENDING;
    reasons.push({ code: "DRINKS_PENDING", text: `${drinksPending} bebidas pendientes`, weight: WEIGHTS.DRINKS_PENDING });
  }

  // Tier
  let tier: PriorityTier;
  if (score >= 250) tier = "CRITICAL";
  else if (score >= 130) tier = "HIGH";
  else if (score >= 60) tier = "MEDIUM";
  else tier = "NORMAL";

  return { score: Math.round(score), tier, reasons };
}

/**
 * Recompute priority for one order and persist score.
 * Useful for cron sweeps and after state changes.
 */
export async function refreshOrderPriority(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { course: true, kitchenStatus: true } } }
  });
  if (!order) return null;

  const result = calcPriority({
    id: order.id,
    createdAt: order.createdAt,
    priority: order.priority,
    vipNote: order.vipNote,
    complaint: order.complaint,
    partySize: order.partySize,
    entradaServedAt: order.entradaServedAt,
    items: order.items
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { priorityScore: result.score }
  });

  return result;
}

/**
 * Get top priority recommendation for kitchen.
 */
export async function topRecommendation(restaurantId: string) {
  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { in: ["OPEN", "KITCHEN"] } },
    include: { items: { select: { course: true, kitchenStatus: true } }, table: true }
  });

  const scored = orders.map(o => ({
    order: o,
    priority: calcPriority({
      id: o.id,
      createdAt: o.createdAt,
      priority: o.priority,
      vipNote: o.vipNote,
      complaint: o.complaint,
      partySize: o.partySize,
      entradaServedAt: o.entradaServedAt,
      items: o.items
    })
  }));

  scored.sort((a, b) => b.priority.score - a.priority.score);
  return scored[0] ?? null;
}
