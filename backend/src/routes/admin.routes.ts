/**
 * MesaSmart · Admin maintenance endpoints
 * Solo ADMIN, idempotentes, sin destruir datos.
 *
 * Estos endpoints existen para correr migraciones de datos
 * cuando no tienes acceso al Shell del servidor.
 */
import { Router } from "express";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminRoutes = Router();

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/backfill/transformations
// Crea las 6 IngredientTransformation de demo si no existen.
// Si faltan ingredientes intermedios/preparados, los crea también.
// Idempotente.
// ═══════════════════════════════════════════════════════════════
const TRANSFORMATIONS = [
  { fromName: "Pescado bonito entero", toName: "Pescado sin vísceras", inputQty: 1.0, outputQty: 0.80, laborMinutes: 5, station: "frio" },
  { fromName: "Pescado sin vísceras",  toName: "Pescado fileteado",   inputQty: 1.0, outputQty: 0.75, laborMinutes: 8, station: "frio" },
  { fromName: "Pescado fileteado",     toName: "Pescado picado",      inputQty: 1.0, outputQty: 0.92, laborMinutes: 12, station: "prep" },
  { fromName: "Pollo entero",          toName: "Pollo trozado",       inputQty: 1.0, outputQty: 0.95, laborMinutes: 5, station: "frio" },
  { fromName: "Pollo trozado",         toName: "Pechugas deshuesadas",inputQty: 1.0, outputQty: 0.70, laborMinutes: 4, station: "frio" },
  { fromName: "Carne de res (lomo)",   toName: "Lomo limpio",         inputQty: 1.0, outputQty: 0.88, laborMinutes: 6, station: "frio" }
];

const INTERMEDIATE_INGS: Array<{ name: string; unit: string; level: "INTERMEDIATE" | "PREPARED" }> = [
  { name: "Pollo trozado",         unit: "kg", level: "INTERMEDIATE" },
  { name: "Pechugas deshuesadas",  unit: "kg", level: "PREPARED" },
  { name: "Pescado sin vísceras",  unit: "kg", level: "INTERMEDIATE" },
  { name: "Pescado fileteado",     unit: "kg", level: "INTERMEDIATE" },
  { name: "Pescado picado",        unit: "kg", level: "PREPARED" },
  { name: "Lomo limpio",           unit: "kg", level: "PREPARED" }
];

adminRoutes.post(
  "/backfill/transformations",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const log: string[] = [];
    const summary = { ingredientsCreated: 0, transformationsCreated: 0, skipped: 0 };

    // 1. Asegurar categoría "Proteínas"
    let cat = await prisma.ingredientCategory.findFirst({
      where: { restaurantId, name: "Proteínas" }
    });
    if (!cat) {
      cat = await prisma.ingredientCategory.create({
        data: { restaurantId, name: "Proteínas", displayOrder: 1 }
      });
      log.push("✓ Creada categoría Proteínas");
    }

    // 2. Asegurar proveedor base
    let sup = await prisma.supplier.findFirst({ where: { restaurantId } });
    if (!sup) {
      sup = await prisma.supplier.create({
        data: { restaurantId, name: "Proveedor Base", contactName: "—", phone: "—" }
      });
      log.push("✓ Creado proveedor base");
    }

    // 3. Asegurar ingredientes intermedios/preparados
    for (const ing of INTERMEDIATE_INGS) {
      const exists = await prisma.ingredient.findFirst({
        where: { restaurantId, name: ing.name }
      });
      if (!exists) {
        await prisma.ingredient.create({
          data: {
            restaurantId,
            categoryId: cat.id,
            supplierId: sup.id,
            name: ing.name,
            unit: ing.unit,
            currentStock: 0,
            minStock: 0,
            criticalStock: 0,
            optimalStock: 5,
            costPerUnitCents: 0,
            trackExpiration: true,
            level: ing.level
          }
        });
        summary.ingredientsCreated++;
        log.push(`✓ Ingrediente intermedio creado: ${ing.name}`);
      }
    }

    // 4. Crear transformaciones (skip si ya existen)
    for (const t of TRANSFORMATIONS) {
      const fromIng = await prisma.ingredient.findFirst({
        where: { restaurantId, name: t.fromName }
      });
      const toIng = await prisma.ingredient.findFirst({
        where: { restaurantId, name: t.toName }
      });
      if (!fromIng || !toIng) {
        log.push(`⚠ Skip ${t.fromName} → ${t.toName} (ingrediente no encontrado)`);
        summary.skipped++;
        continue;
      }
      const dup = await prisma.ingredientTransformation.findFirst({
        where: {
          restaurantId,
          fromIngredientId: fromIng.id,
          toIngredientId: toIng.id
        }
      });
      if (dup) {
        summary.skipped++;
        continue;
      }

      const yieldPct = (t.outputQty / t.inputQty) * 100;
      const laborCostCents = Math.round(t.laborMinutes * 50);

      await prisma.ingredientTransformation.create({
        data: {
          restaurantId,
          fromIngredientId: fromIng.id,
          toIngredientId: toIng.id,
          inputQty: t.inputQty,
          outputQty: t.outputQty,
          yieldPct,
          laborMinutes: t.laborMinutes,
          laborCostCents,
          station: t.station
        }
      });
      summary.transformationsCreated++;
      log.push(`✓ ${t.fromName} → ${t.toName} (yield ${yieldPct.toFixed(0)}%)`);
    }

    res.json({ ok: true, restaurantId, summary, log });
  })
);

// ═══════════════════════════════════════════════════════════════
// POST /api/admin/backfill/security
// Crea cámaras + reglas + alertas demo si no existen.
// Idempotente.
// ═══════════════════════════════════════════════════════════════
const SECURITY_CAMERAS = [
  { name: "Cámara Caja Principal", location: "CAJA", thumbnailUrl: "https://images.unsplash.com/photo-1556742393-d75f468bfcb0?auto=format&fit=crop&w=400&q=70" },
  { name: "Cámara Cocina Brasa", location: "COCINA", thumbnailUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=400&q=70" },
  { name: "Cámara Almacén", location: "ALMACEN", thumbnailUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=70" },
  { name: "Cámara Puerta Trasera", location: "PUERTA_TRASERA", thumbnailUrl: "https://images.unsplash.com/photo-1568998270908-fe1f57c8f6e0?auto=format&fit=crop&w=400&q=70" },
  { name: "Cámara Salón Principal", location: "SALON", thumbnailUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=70" },
  { name: "Cámara Barra", location: "BARRA", thumbnailUrl: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=400&q=70" }
];

const SECURITY_RULES = ["FAKE_RECEIPT", "THEFT_INVENTORY", "OPEN_REGISTER_NO_TX", "UNUSUAL_AREA", "UNRECORDED_CONSUMPTION", "TAMPERING"];

adminRoutes.post(
  "/backfill/security",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const log: string[] = [];
    const summary = { camerasCreated: 0, rulesCreated: 0, alertsCreated: 0 };

    // Cámaras
    const existingCams = new Map<string, string>();
    for (const cam of SECURITY_CAMERAS) {
      const existing = await prisma.camera.findFirst({
        where: { restaurantId, name: cam.name }
      });
      if (existing) {
        existingCams.set(cam.location, existing.id);
        continue;
      }
      const created = await prisma.camera.create({
        data: { restaurantId, ...cam, status: "ONLINE" }
      });
      existingCams.set(cam.location, created.id);
      summary.camerasCreated++;
      log.push(`✓ Cámara creada: ${cam.name}`);
    }

    // Reglas
    for (const type of SECURITY_RULES) {
      const existing = await prisma.securityRule.findFirst({
        where: { restaurantId, type }
      });
      if (existing) continue;
      await prisma.securityRule.create({
        data: { restaurantId, type, enabled: true, sensitivity: "MEDIUM" }
      });
      summary.rulesCreated++;
      log.push(`✓ Regla creada: ${type}`);
    }

    // Alertas (solo si no hay)
    const existingAlerts = await prisma.securityAlert.count({ where: { restaurantId } });
    if (existingAlerts === 0) {
      const now = Date.now();
      const ago = (mins: number) => new Date(now - mins * 60 * 1000);

      const demoAlerts = [
        { cameraId: existingCams.get("CAJA")!, type: "FAKE_RECEIPT", severity: "HIGH", title: "Posible papel en blanco entregado al cliente", description: "El cajero entregó al cliente un papel sin elementos típicos de boleta SUNAT (sin QR, series ni logo). Validar registro en POS.", aiRationale: "Frame muestra papel sin marcas de impresión visibles ni QR. POS no registró ticket para esa mesa.", aiConfidence: 0.87, detectedAt: ago(8), status: "PENDING", estimatedLossCents: 8950 },
        { cameraId: existingCams.get("ALMACEN")!, type: "THEFT_INVENTORY", severity: "CRITICAL", title: "Insumo retirado en mochila personal", description: "Empleado tomó botella del estante de licores y la guardó en mochila personal antes del cambio de turno.", aiRationale: "Movimiento del estante 3 (vinos) a mochila roja a 21:34. Sin merma autorizada en sistema.", aiConfidence: 0.91, detectedAt: ago(45), status: "PENDING", estimatedLossCents: 18500 },
        { cameraId: existingCams.get("PUERTA_TRASERA")!, type: "THEFT_INVENTORY", severity: "HIGH", title: "Salida sospechosa por puerta trasera 21:48", description: "Empleado salió por puerta de servicio cargando bolsa inusual fuera del horario de despacho.", aiRationale: "Salida 21:48. Bolsa ~60cm. No hay despacho programado.", aiConfidence: 0.78, detectedAt: ago(120), status: "REVIEWING", estimatedLossCents: 24000 },
        { cameraId: existingCams.get("CAJA")!, type: "OPEN_REGISTER_NO_TX", severity: "MEDIUM", title: "Caja abierta 14 segundos sin transacción", description: "Cajón abierto sin tx asociada en POS. Última operación 6min antes.", aiRationale: "Apertura 13:21-13:35 sin actividad POS ±2min.", aiConfidence: 0.74, detectedAt: ago(180), status: "PENDING", estimatedLossCents: 4200 },
        { cameraId: existingCams.get("BARRA")!, type: "UNRECORDED_CONSUMPTION", severity: "MEDIUM", title: "Bartender sirvió 2 tragos sin comanda", description: "2 cocteles servidos a personas en barra sin comanda activa.", aiRationale: "Preparación 19:42. Posiciones B3-B4 sin comanda. Clientes nuevos.", aiConfidence: 0.69, detectedAt: ago(360), status: "PENDING", estimatedLossCents: 5600 },
        { cameraId: existingCams.get("COCINA")!, type: "UNRECORDED_CONSUMPTION", severity: "LOW", title: "Consumo de bebida sin registro", description: "Empleado cocina consumió bebida sin registro en mermas.", aiRationale: "Apertura refri y consumo directo. Sin registro en consumos staff.", aiConfidence: 0.62, detectedAt: ago(540), status: "DISMISSED", reviewedAt: ago(420), actionTaken: "NO_ACTION", notes: "Verificado · agua cortesía staff", estimatedLossCents: 0 },
        { cameraId: existingCams.get("SALON")!, type: "UNUSUAL_AREA", severity: "LOW", title: "Empleado de cocina en zona de mesas 5min", description: "Permanencia prolongada en zona no asignada durante turno de servicio.", aiRationale: "Uniforme cocina identificado en mesa 8 vacía sin solicitud activa.", aiConfidence: 0.55, detectedAt: ago(900), status: "DISMISSED", reviewedAt: ago(840), actionTaken: "NO_ACTION", notes: "Pausa autorizada", estimatedLossCents: 0 },
        { cameraId: existingCams.get("CAJA")!, type: "FAKE_RECEIPT", severity: "HIGH", title: "Boleta entregada sin emisión registrada", description: "Cliente recibió papel tipo boleta pero POS no registró emisión.", aiRationale: "Entrega 12:48. POS sin emisión 12:46-12:50.", aiConfidence: 0.83, detectedAt: ago(1380), status: "CONFIRMED", reviewedAt: ago(1200), actionTaken: "WRITTEN_WARNING", notes: "Confirmado · 2do incidente del mes", estimatedLossCents: 12400 }
      ];

      for (const a of demoAlerts) {
        await prisma.securityAlert.create({ data: { restaurantId, ...a } });
        summary.alertsCreated++;
      }
      log.push(`✓ ${demoAlerts.length} alertas demo creadas`);
    }

    res.json({ ok: true, restaurantId, summary, log });
  })
);

// ═══════════════════════════════════════════════════════════════
// GET /api/admin/health/data
// Reporte rápido de cuántos registros tiene el restaurante
// ═══════════════════════════════════════════════════════════════
adminRoutes.get(
  "/health/data",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;

    // MenuItems no tienen restaurantId directo — se cuentan via category
    const menuItemIds = (await prisma.menuItem.findMany({
      where: { category: { restaurantId } },
      select: { id: true }
    })).map(m => m.id);

    const [
      ingredients, transformations, suppliers,
      orders, employees, customers, recipes
    ] = await Promise.all([
      prisma.ingredient.count({ where: { restaurantId } }),
      prisma.ingredientTransformation.count({ where: { restaurantId } }),
      prisma.supplier.count({ where: { restaurantId } }),
      prisma.order.count({ where: { restaurantId } }),
      prisma.user.count({ where: { restaurantId } }),
      prisma.customer.count({ where: { restaurantId } }),
      prisma.recipeIngredient.count({ where: { menuItemId: { in: menuItemIds } } })
    ]);

    res.json({
      restaurantId,
      counts: {
        ingredients,
        transformations,
        suppliers,
        menuItems: menuItemIds.length,
        recipes,
        orders,
        employees,
        customers
      },
      flags: {
        needsTransformationsBackfill: transformations === 0 && ingredients > 0
      }
    });
  })
);
