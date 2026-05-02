/**
 * Personnel & Nómina Routes
 * ──────────────────────────
 * Gestión de empleados: posición, sueldo, contrato, costo laboral total mensual.
 * Calcula costo laboral del periodo y se integra al P&L como costo fijo.
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";

export const personnelRoutes = Router();

const POSITIONS = [
  "Administrador",
  "Cajero/a",
  "Mozo/a",
  "Chef ejecutivo",
  "Cocinero/a",
  "Ayudante de cocina",
  "Bartender",
  "Limpieza",
  "Vigilancia",
  "Cajero/a · Delivery",
  "Repartidor/a"
];

personnelRoutes.get(
  "/positions",
  authRequired,
  asyncHandler(async (_req, res) => {
    res.json(POSITIONS);
  })
);

/**
 * Lista de personal con costo total mensual calculado (sueldo + sobrecostos).
 */
personnelRoutes.get(
  "/",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.user!.restaurantId }
    });
    if (!restaurant) throw new HttpError(404, "restaurant_not_found");

    const users = await prisma.user.findMany({
      where: { restaurantId: req.user!.restaurantId },
      orderBy: [{ active: "desc" }, { name: "asc" }]
    });

    const overhead = restaurant.laborOverheadPct;

    const enriched = users.map(u => {
      const baseCents = u.monthlySalaryCents ||
        (u.hourlyRateCents && u.expectedHoursPerWeek
          ? Math.round(u.hourlyRateCents * u.expectedHoursPerWeek * 4.33)
          : 0);
      const overheadCents = Math.round(baseCents * overhead);
      const totalCostCents = baseCents + overheadCents;
      return {
        ...u,
        passwordHash: undefined,
        baseCents,
        overheadCents,
        totalCostCents
      };
    });

    const totalMonthlyCostCents = enriched.reduce(
      (s, u) => s + (u.active ? u.totalCostCents : 0),
      0
    );

    res.json({
      laborOverheadPct: overhead,
      totalMonthlyCostCents,
      activeCount: enriched.filter(e => e.active).length,
      personnel: enriched
    });
  })
);

/**
 * Detalle de un empleado.
 */
personnelRoutes.get(
  "/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u || u.restaurantId !== req.user!.restaurantId) throw new HttpError(404, "not_found");
    const { passwordHash, ...rest } = u;
    res.json(rest);
  })
);

/**
 * Crear empleado nuevo (sin password real - el admin lo gestiona).
 * Se usa cuando solo se quiere registrarlo para nómina pero no para login.
 */
const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "CASHIER", "WAITER", "KITCHEN"]).default("WAITER"),
  position: z.string().optional(),
  contractType: z.enum(["FULL_TIME", "PART_TIME", "HOURLY", "TIPPED", "EXTERNAL"]).optional(),
  monthlySalaryCents: z.number().int().min(0).optional(),
  hourlyRateCents: z.number().int().min(0).optional(),
  expectedHoursPerWeek: z.number().int().min(0).max(72).optional(),
  hiredAt: z.string().datetime().optional(),
  dni: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  avatarColor: z.string().optional()
});

personnelRoutes.post(
  "/",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const fakeEmail = data.email || `staff-${Date.now()}@${req.user!.restaurantId}.local`;
    const u = await prisma.user.create({
      data: {
        restaurantId: req.user!.restaurantId,
        email: fakeEmail,
        passwordHash: "$2b$10$NoLoginHash", // sin login activo
        name: data.name,
        role: data.role,
        position: data.position,
        contractType: data.contractType,
        monthlySalaryCents: data.monthlySalaryCents,
        hourlyRateCents: data.hourlyRateCents,
        expectedHoursPerWeek: data.expectedHoursPerWeek,
        hiredAt: data.hiredAt ? new Date(data.hiredAt) : new Date(),
        dni: data.dni,
        phone: data.phone,
        notes: data.notes,
        avatarColor: data.avatarColor || "#A0322B"
      }
    });
    res.status(201).json({ ...u, passwordHash: undefined });
  })
);

/**
 * Actualizar datos laborales del empleado.
 */
const patchSchema = z.object({
  name: z.string().optional(),
  position: z.string().optional().nullable(),
  contractType: z.enum(["FULL_TIME", "PART_TIME", "HOURLY", "TIPPED", "EXTERNAL"]).nullable().optional(),
  monthlySalaryCents: z.number().int().min(0).nullable().optional(),
  hourlyRateCents: z.number().int().min(0).nullable().optional(),
  expectedHoursPerWeek: z.number().int().min(0).max(72).nullable().optional(),
  hiredAt: z.string().datetime().nullable().optional(),
  terminatedAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
  dni: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  avatarColor: z.string().optional()
});

personnelRoutes.patch(
  "/:id",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u || u.restaurantId !== req.user!.restaurantId) throw new HttpError(404, "not_found");
    const data = patchSchema.parse(req.body);
    const updateData: any = { ...data };
    if (data.hiredAt !== undefined) updateData.hiredAt = data.hiredAt ? new Date(data.hiredAt) : null;
    if (data.terminatedAt !== undefined) updateData.terminatedAt = data.terminatedAt ? new Date(data.terminatedAt) : null;

    // Audit
    await prisma.auditLog.create({
      data: {
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        action: "PERSONNEL_UPDATE",
        entityType: "User",
        entityId: u.id,
        before: JSON.stringify({
          position: u.position, monthlySalaryCents: u.monthlySalaryCents,
          hourlyRateCents: u.hourlyRateCents, active: u.active
        }),
        after: JSON.stringify(data)
      }
    });

    const updated = await prisma.user.update({ where: { id: u.id }, data: updateData });
    res.json({ ...updated, passwordHash: undefined });
  })
);

/**
 * Configuración de overhead laboral del restaurante.
 */
const overheadSchema = z.object({ laborOverheadPct: z.number().min(0).max(2) });

personnelRoutes.patch(
  "/config/overhead",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { laborOverheadPct } = overheadSchema.parse(req.body);
    const r = await prisma.restaurant.update({
      where: { id: req.user!.restaurantId },
      data: { laborOverheadPct }
    });
    res.json({ laborOverheadPct: r.laborOverheadPct });
  })
);

/**
 * Costo laboral del periodo (helper para P&L).
 * Calcula prorateado a los días del rango.
 */
personnelRoutes.get(
  "/cost-summary",
  authRequired,
  requireRole("ADMIN", "CASHIER"),
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(req.query.from as string) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const restaurant = await prisma.restaurant.findUnique({ where: { id: req.user!.restaurantId } });
    if (!restaurant) throw new HttpError(404, "restaurant_not_found");

    const users = await prisma.user.findMany({
      where: { restaurantId: req.user!.restaurantId, active: true }
    });

    const overhead = restaurant.laborOverheadPct;
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    const periodFraction = days / 30;

    const breakdown = users.map(u => {
      const baseCents = u.monthlySalaryCents ||
        (u.hourlyRateCents && u.expectedHoursPerWeek
          ? Math.round(u.hourlyRateCents * u.expectedHoursPerWeek * 4.33)
          : 0);
      const totalMonthly = Math.round(baseCents * (1 + overhead));
      const periodCost = Math.round(totalMonthly * periodFraction);
      return {
        userId: u.id,
        name: u.name,
        position: u.position,
        baseCents,
        totalMonthlyCents: totalMonthly,
        periodCostCents: periodCost
      };
    });

    const totalPeriodCostCents = breakdown.reduce((s, b) => s + b.periodCostCents, 0);
    const totalMonthlyCents = breakdown.reduce((s, b) => s + b.totalMonthlyCents, 0);

    res.json({
      from, to, days,
      laborOverheadPct: overhead,
      totalMonthlyCents,
      totalPeriodCostCents,
      headcount: users.length,
      breakdown
    });
  })
);
