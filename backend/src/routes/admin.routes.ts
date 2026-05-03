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
// POST /api/admin/backfill/engagement
// Pairings + NPS demo + Google reviews + prep-time targets + upsell events
// ═══════════════════════════════════════════════════════════════
adminRoutes.post(
  "/backfill/engagement",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const log: string[] = [];
    const summary = { pairings: 0, targets: 0, npsResponses: 0, reviews: 0, upsells: 0 };

    // Helper para encontrar menuItem por nombre
    const items = await prisma.menuItem.findMany({
      where: { category: { restaurantId } },
      include: { category: true }
    });
    const findItem = (name: string) => items.find(i => i.name.toLowerCase().includes(name.toLowerCase()));

    // ─── Pairings · sugerencias smart de postres y bebidas ───
    const pairingDefs = [
      // Pollo a la Brasa → bebidas + postres
      { trigger: "Pollo Entero a la Brasa", suggestion: "Inka Cola", type: "BEVERAGE", message: "¿Le agregamos Inka Cola 1.5L? Perfecta con la brasa." },
      { trigger: "Pollo Entero a la Brasa", suggestion: "Chicha Morada", type: "BEVERAGE", message: "Chicha morada artesanal de la casa, ¿le sirve una jarra?" },
      { trigger: "Pollo Entero a la Brasa", suggestion: "Mazamorra Morada", type: "DESSERT", message: "De postre, mazamorra morada con arroz con leche, muy peruano." },
      { trigger: "1/2 Pollo a la Brasa", suggestion: "Inka Cola", type: "BEVERAGE", message: "¿Le agregamos Inka Cola personal?" },
      { trigger: "1/2 Pollo a la Brasa", suggestion: "Suspiro", type: "DESSERT", message: "¿De postre suspiro a la limeña? Es nuestro top." },
      { trigger: "1/4 de Pollo", suggestion: "Inka Cola", type: "BEVERAGE", message: "¿Le agregamos Inka Cola personal?" },
      { trigger: "1/4 de Pollo", suggestion: "Suspiro", type: "DESSERT", message: "Suspiro limeño · ideal para uno." },
      // Lomo Saltado → bebida + postre
      { trigger: "Lomo Saltado", suggestion: "Chicha Morada", type: "BEVERAGE", message: "Chicha morada va perfecto con el lomo." },
      { trigger: "Lomo Saltado", suggestion: "Crema Volteada", type: "DESSERT", message: "Crema volteada de la casa, hecha hoy." },
      // Anticuchos → bebida
      { trigger: "Anticuchos", suggestion: "Cusqueña", type: "BEVERAGE", message: "Cerveza Cusqueña Negra con anticuchos, clásico." },
      { trigger: "Anticuchos", suggestion: "Picarones", type: "DESSERT", message: "Y para cerrar, picarones con miel de chancaca." },
      // Ceviche → bebida
      { trigger: "Ceviche", suggestion: "Cusqueña", type: "BEVERAGE", message: "¿Una Cusqueña dorada bien helada con el ceviche?" }
    ];

    for (const def of pairingDefs) {
      const trigger = findItem(def.trigger);
      const suggestion = findItem(def.suggestion);
      if (!trigger || !suggestion) continue;

      const exists = await prisma.menuPairing.findFirst({
        where: { restaurantId, triggerItemId: trigger.id, suggestedItemId: suggestion.id }
      });
      if (exists) continue;

      // Random conversion rate y shown count para que se vean métricas
      const totalShown = 30 + Math.floor(Math.random() * 80);
      const totalAccepted = Math.floor(totalShown * (0.20 + Math.random() * 0.45));

      await prisma.menuPairing.create({
        data: {
          restaurantId,
          triggerItemId: trigger.id,
          suggestedItemId: suggestion.id,
          pairingType: def.type as any,
          priority: def.type === "DESSERT" ? 8 : 6,
          message: def.message,
          totalShown,
          totalAccepted,
          conversionRate: totalAccepted / totalShown
        }
      });
      summary.pairings++;
    }
    log.push(`✓ ${summary.pairings} pairings creadas`);

    // ─── Prep-time targets · meta por plato ───
    const targetDefs = [
      { name: "Pollo Entero", minutes: 22 },
      { name: "1/2 Pollo", minutes: 18 },
      { name: "1/4 de Pollo", minutes: 14 },
      { name: "Lomo Saltado", minutes: 16 },
      { name: "Anticuchos", minutes: 18 },
      { name: "Ceviche", minutes: 8 },
      { name: "Causa", minutes: 6 },
      { name: "Inka Cola", minutes: 1 },
      { name: "Chicha Morada", minutes: 2 },
      { name: "Suspiro", minutes: 3 },
      { name: "Mazamorra", minutes: 3 }
    ];
    for (const t of targetDefs) {
      const item = findItem(t.name);
      if (!item) continue;
      const exists = await prisma.prepTimeTarget.findFirst({
        where: { restaurantId, menuItemId: item.id, station: item.kitchenStation }
      });
      if (exists) continue;
      await prisma.prepTimeTarget.create({
        data: {
          restaurantId,
          menuItemId: item.id,
          station: item.kitchenStation,
          targetMinutes: t.minutes,
          warningMinutes: Math.round(t.minutes * 1.2),
          criticalMinutes: Math.round(t.minutes * 1.5),
          // Auto-calc placeholder
          totalSamples: 50 + Math.floor(Math.random() * 80),
          avgMinutes: t.minutes * (0.85 + Math.random() * 0.4),
          p50Minutes: t.minutes * 0.95,
          p75Minutes: t.minutes * 1.15,
          p95Minutes: t.minutes * 1.55,
          hitRatePct: 60 + Math.random() * 35
        }
      });
      summary.targets++;
    }
    log.push(`✓ ${summary.targets} prep-time targets creados`);

    // ─── NPS demo · respuestas variadas ───
    const existing = await prisma.nPSResponse.count({ where: { restaurantId } });
    if (existing < 5) {
      const waiters = await prisma.user.findMany({
        where: { restaurantId, role: "WAITER" }
      });
      const sampleResponses = [
        { score: 10, food: 5, service: 5, ambience: 5, speed: 4, comment: "Excelente atención, María estuvo muy atenta. La pachamanca volada." },
        { score: 9, food: 5, service: 5, ambience: 4, speed: 4, comment: "Comida deliciosa, repetiría sin duda." },
        { score: 9, food: 4, service: 5, ambience: 4, speed: 5, comment: "Mozo muy buen rollo. Volveremos." },
        { score: 8, food: 4, service: 4, ambience: 4, speed: 4, comment: "Bien todo, demoraron un poco las bebidas." },
        { score: 10, food: 5, service: 5, ambience: 5, speed: 5, comment: null },
        { score: 7, food: 4, service: 3, ambience: 4, speed: 3, comment: "Comida rica pero el servicio podría ser más rápido en hora pico." },
        { score: 6, food: 4, service: 3, ambience: 3, speed: 2, comment: "Esperamos 35 minutos por el plato. Mejorables." },
        { score: 3, food: 4, service: 1, ambience: 2, speed: 1, comment: "Muy mala atención, pedimos cuenta 4 veces. La comida sí estuvo bien." },
        { score: 9, food: 5, service: 4, ambience: 5, speed: 4, comment: "Muy buena experiencia, recomendado para familia." },
        { score: 10, food: 5, service: 5, ambience: 5, speed: 5, comment: "El mejor pollo a la brasa que he probado en Lima." },
        { score: 8, food: 5, service: 4, ambience: 4, speed: 4, comment: null },
        { score: 4, food: 3, service: 2, ambience: 3, speed: 2, comment: "Ceviche estaba tibio, mozo no nos hacía caso." },
        { score: 9, food: 5, service: 5, ambience: 4, speed: 4, comment: "Inolvidable. La sazón tradicional se siente." }
      ];

      for (const r of sampleResponses) {
        const w = waiters[Math.floor(Math.random() * waiters.length)];
        const cat = r.score >= 9 ? "PROMOTER" : r.score >= 7 ? "PASSIVE" : "DETRACTOR";
        const sentiment = r.comment
          ? (r.score >= 7 ? "POSITIVE" : r.score >= 5 ? "NEUTRAL" : "NEGATIVE")
          : null;
        const daysAgo = Math.floor(Math.random() * 30);
        const respondedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        await prisma.nPSResponse.create({
          data: {
            restaurantId,
            waiterId: w?.id,
            npsScore: r.score,
            category: cat,
            foodScore: r.food,
            serviceScore: r.service,
            ambienceScore: r.ambience,
            speedScore: r.speed,
            comment: r.comment,
            sentiment,
            source: "TABLET",
            respondedAt
          }
        });
        summary.npsResponses++;
      }
      log.push(`✓ ${summary.npsResponses} respuestas NPS demo creadas`);
    }

    // ─── External reviews demo (Google) ───
    const existingReviews = await prisma.externalReview.count({ where: { restaurantId } });
    if (existingReviews < 3) {
      const reviewDefs = [
        { source: "GOOGLE", rating: 5, author: "Juan Pérez", title: "El mejor pollo de Miraflores", body: "La sazón es de antaño, las papas crocantes y la cremita ají amarillo de la casa. 100% recomendado.", days: 5 },
        { source: "GOOGLE", rating: 5, author: "Ana Castillo", title: "Atención de primera", body: "Fui con mi familia y María nos atendió increíble. El pollo perfecto.", days: 12 },
        { source: "GOOGLE", rating: 4, author: "Carlos M.", title: "Buena experiencia", body: "Comida deliciosa, solo tardaron un poco más de lo esperado. Volveré.", days: 18 },
        { source: "GOOGLE", rating: 5, author: "Patricia G.", title: "Pollo + chicha morada = vida", body: "Llevo años yendo y nunca decae. Imperdible.", days: 25 },
        { source: "GOOGLE", rating: 3, author: "Roberto S.", title: "Bien pero...", body: "La comida estuvo bien pero el local muy lleno y demoró todo. Quizás otro día.", days: 33 },
        { source: "TRIPADVISOR", rating: 5, author: "Luis F.", title: "Local hidden gem in Miraflores", body: "Authentic peruvian rotisserie chicken. The crispy potatoes are addictive.", days: 8 },
        { source: "GOOGLE", rating: 2, author: "Cliente anónimo", title: "Decepcionante", body: "Esperamos mucho, mozo desatento, comida tibia. No volvería.", days: 41 }
      ];
      for (const r of reviewDefs) {
        const sentiment = r.rating >= 4 ? "POSITIVE" : r.rating >= 3 ? "NEUTRAL" : "NEGATIVE";
        await prisma.externalReview.create({
          data: {
            restaurantId,
            source: r.source,
            externalId: `demo-${Date.now()}-${Math.random()}`,
            authorName: r.author,
            rating: r.rating,
            title: r.title,
            body: r.body,
            sentiment,
            reviewedAt: new Date(Date.now() - r.days * 24 * 60 * 60 * 1000)
          }
        });
        summary.reviews++;
      }
      log.push(`✓ ${summary.reviews} reviews externas creadas`);
    }

    // ─── Upsell events demo ───
    const pairings = await prisma.menuPairing.findMany({
      where: { restaurantId },
      take: 6
    });
    const existingEvents = await prisma.upsellEvent.count({ where: { restaurantId } });
    if (existingEvents < 5 && pairings.length > 0) {
      const waiters = await prisma.user.findMany({
        where: { restaurantId, role: "WAITER" }
      });
      for (let i = 0; i < 30; i++) {
        const p = pairings[Math.floor(Math.random() * pairings.length)];
        const w = waiters[Math.floor(Math.random() * waiters.length)];
        if (!w) continue;
        const accepted = Math.random() < 0.45;
        await prisma.upsellEvent.create({
          data: {
            restaurantId,
            waiterId: w.id,
            pairingId: p.id,
            triggerItemId: p.triggerItemId,
            suggestedItemId: p.suggestedItemId,
            outcome: accepted ? "ACCEPTED" : (Math.random() < 0.6 ? "REJECTED" : "IGNORED"),
            outcomeAt: new Date(),
            acceptedQty: accepted ? 1 : 0,
            acceptedRevenueCents: accepted ? 1500 + Math.floor(Math.random() * 4000) : 0,
            shownAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000))
          }
        });
        summary.upsells++;
      }
      log.push(`✓ ${summary.upsells} upsell events demo creados`);
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
