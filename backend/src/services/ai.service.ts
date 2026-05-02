/**
 * AI Service · Claude (Anthropic) integration
 * ─────────────────────────────────────────────
 * Capa OPCIONAL sobre el motor determinístico de Smart Priority.
 * Usa Claude para enriquecer decisiones con lenguaje natural y heurísticas
 * más ricas que las puras reglas. Si no hay API key, hace fallback automático.
 *
 * Casos de uso:
 *  1. Explicar al chef en lenguaje natural por qué un ticket es prioritario
 *  2. Sugerir secuencia óptima de preparación dada la carga actual
 *  3. Clasificar quejas / feedback de clientes
 *  4. Traducir descripciones del menú a otros idiomas
 *  5. Generar respuestas personalizadas a reseñas
 *
 * IMPORTANTE: la API key NUNCA debe vivir en código. Solo en .env (gitignored).
 */

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { PriorityResult } from "./priority.service.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  content: { type: string; text: string }[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

class AIService {
  private get enabled(): boolean {
    return env.AI_FEATURES_ENABLED && Boolean(env.ANTHROPIC_API_KEY);
  }

  private async callClaude(opts: {
    system?: string;
    messages: ClaudeMessage[];
    maxTokens?: number;
    temperature?: number;
    visionImage?: { mediaType: string; data: string };
  }): Promise<string | null> {
    if (!this.enabled) return null;
    try {
      // If vision image present, transform first user message into multi-content
      const messages = opts.visionImage
        ? opts.messages.map((m, idx) => {
            if (idx === 0 && m.role === "user") {
              return {
                role: "user" as const,
                content: [
                  { type: "image", source: { type: "base64", media_type: opts.visionImage!.mediaType, data: opts.visionImage!.data } },
                  { type: "text", text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }
                ]
              };
            }
            return m;
          })
        : opts.messages;

      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: env.ANTHROPIC_MODEL,
          max_tokens: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? 0.3,
          system: opts.system,
          messages
        })
      });
      if (!res.ok) {
        logger.warn({ status: res.status, body: await res.text() }, "Claude API error");
        return null;
      }
      const data = (await res.json()) as ClaudeResponse;
      return data.content?.[0]?.text ?? null;
    } catch (err) {
      logger.error({ err }, "Claude API call failed");
      return null;
    }
  }

  /**
   * Genera una explicación humana de por qué un ticket es prioritario.
   * Si no hay AI, devuelve el primer reason del algoritmo.
   */
  async explainPriority(input: {
    mesa: number;
    tier: string;
    score: number;
    reasons: { code: string; text: string; weight: number }[];
    items: { name: string; qty: number; status: string; course: string }[];
  }): Promise<string> {
    if (!this.enabled || input.reasons.length === 0) {
      return input.reasons[0]?.text ?? "Sin razón específica";
    }
    const text = await this.callClaude({
      system: "Eres asistente de cocina de un restaurante peruano. Explica en una sola frase corta (máx 18 palabras), en español, en tono profesional y directo, por qué este ticket debe priorizarse. Sin emojis. Sin saludos.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      maxTokens: 80,
      temperature: 0.3
    });
    return text?.trim() ?? input.reasons[0].text;
  }

  /**
   * Sugiere secuencia óptima de preparación para una estación dado el estado actual.
   */
  async suggestSequence(input: {
    station: string;
    pendingItems: { itemName: string; orderId: string; mesa: number; prepMinutes: number; waitedMinutes: number; priority: PriorityResult }[];
  }): Promise<{ sequence: string[]; rationale: string } | null> {
    if (!this.enabled || input.pendingItems.length < 2) return null;
    const text = await this.callClaude({
      system: `Eres jefe de estación "${input.station}" de una pollería peruana. Tu objetivo: minimizar tiempo total de espera ponderado por prioridad. Devuelve JSON estricto: {"sequence":[orderId1, orderId2, ...], "rationale": "frase corta"}. Sin texto adicional.`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ items: input.pendingItems })
        }
      ],
      maxTokens: 400,
      temperature: 0.2
    });
    if (!text) return null;
    try {
      const parsed = JSON.parse(text.replace(/```json\s*|\s*```/g, ""));
      return parsed;
    } catch {
      logger.warn("Failed to parse AI sequence suggestion");
      return null;
    }
  }

  /**
   * Categoriza una queja del cliente y sugiere acción.
   */
  async classifyComplaint(complaintText: string): Promise<{
    category: "DELAY" | "FOOD_QUALITY" | "STAFF" | "CLEANLINESS" | "PRICE" | "OTHER";
    severity: "LOW" | "MEDIUM" | "HIGH";
    suggestedAction: string;
  } | null> {
    if (!this.enabled) {
      // Fallback rule-based
      const lower = complaintText.toLowerCase();
      let category: any = "OTHER";
      if (/demor|tarda|atraso|esperar/.test(lower)) category = "DELAY";
      else if (/frío|crudo|salado|sabor|mal cocinado|insípido/.test(lower)) category = "FOOD_QUALITY";
      else if (/mozo|mesero|grosero|trato/.test(lower)) category = "STAFF";
      else if (/sucio|baño|limpieza/.test(lower)) category = "CLEANLINESS";
      return { category, severity: "MEDIUM", suggestedAction: "Atender personalmente al cliente y ofrecer compensación." };
    }
    const text = await this.callClaude({
      system: `Clasifica quejas de restaurante. Responde SOLO JSON: {"category": "DELAY|FOOD_QUALITY|STAFF|CLEANLINESS|PRICE|OTHER", "severity": "LOW|MEDIUM|HIGH", "suggestedAction": "frase corta en español"}`,
      messages: [{ role: "user", content: complaintText }],
      maxTokens: 200,
      temperature: 0.1
    });
    try {
      return text ? JSON.parse(text.replace(/```json\s*|\s*```/g, "")) : null;
    } catch {
      return null;
    }
  }

  /**
   * Traduce texto del menú al idioma objetivo (en, pt, fr).
   */
  async translateMenuText(text: string, targetLang: "en" | "pt" | "fr"): Promise<string | null> {
    if (!this.enabled) return null;
    const langName = { en: "English", pt: "Portuguese (Brazilian)", fr: "French" }[targetLang];
    const result = await this.callClaude({
      system: `You are a translator for a Peruvian restaurant menu. Translate accurately to ${langName}, keeping Peruvian dish names in original (e.g., "ceviche", "anticuchos") with a brief explanation if needed. Return only the translation, no preamble.`,
      messages: [{ role: "user", content: text }],
      maxTokens: 300,
      temperature: 0.1
    });
    return result?.trim() ?? null;
  }

  /**
   * Genera recomendación personalizada para el cliente basada en items en su carrito.
   */
  async recommendForCustomer(input: { cartItems: string[]; allItems: { name: string; description: string }[] }): Promise<string | null> {
    if (!this.enabled || input.cartItems.length === 0) return null;
    const text = await this.callClaude({
      system: "Eres sommelier de una pollería peruana. Sugieres UN solo plato adicional que vaya bien con lo que el cliente ya pidió. Devuelves SOLO el nombre del plato del menú dado, sin explicación.",
      messages: [
        {
          role: "user",
          content: `Carrito actual: ${input.cartItems.join(", ")}\n\nMenú disponible:\n${input.allItems.map(i => `- ${i.name}: ${i.description}`).join("\n")}\n\n¿Qué plato del menú complementaría mejor?`
        }
      ],
      maxTokens: 50,
      temperature: 0.7
    });
    return text?.trim().split("\n")[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════
  //                    ERP — VISION (photo count)
  // ═══════════════════════════════════════════════════════════

  /**
   * Cuenta insumos a partir de una foto (Claude Vision).
   * Recibe el catálogo de insumos esperados con su unidad.
   * Devuelve estimaciones por insumo identificado con nivel de confianza.
   */
  async countIngredientsFromPhoto(input: {
    imageBase64: string;
    imageMediaType: "image/jpeg" | "image/png" | "image/webp";
    expectedIngredients: { id: string; name: string; unit: string }[];
    context?: string; // e.g., "Foto de cámara fría / despensa de salsas"
  }): Promise<{
    counts: { ingredientId: string; ingredientName: string; estimatedQty: number; unit: string; confidence: "low" | "medium" | "high"; reasoning: string }[];
    notes: string;
  } | null> {
    if (!this.enabled) {
      // Fallback: returns empty so UI knows to require manual count
      return null;
    }

    const catalog = input.expectedIngredients
      .map(i => `- ${i.id} | ${i.name} (${i.unit})`)
      .join("\n");

    const text = await this.callClaude({
      system: `Eres un asistente experto en inventario de cocina peruana. Recibirás una foto de la despensa, refrigerador o estante. Identifica los insumos visibles del catálogo proporcionado y estima la cantidad presente en la unidad correcta.

Reglas críticas:
- SOLO identificar insumos del catálogo. Si ves algo que no está en él, ignóralo.
- Estimar con honestidad: si no puedes ver claramente, usa confidence "low".
- Para botellas/latas: cuenta unidades visibles. Para bolsas/sacos: estima peso por tamaño visual. Para bandejas de carne: estima peso.
- Si un insumo NO aparece en la foto, NO lo incluyas en la respuesta.

Devuelve SOLO un JSON con esta forma exacta:
{
  "counts": [
    {"ingredientId": "id-from-catalog", "ingredientName": "nombre", "estimatedQty": 0.0, "unit": "kg|l|unidad", "confidence": "high|medium|low", "reasoning": "qué viste"}
  ],
  "notes": "observaciones generales en una frase corta"
}`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            type: "vision_request",
            context: input.context ?? "inventory photo",
            catalog
          })
        }
      ],
      maxTokens: 1500,
      temperature: 0.1,
      visionImage: { mediaType: input.imageMediaType, data: input.imageBase64 }
    });

    if (!text) return null;
    try {
      const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      logger.warn({ err, text: text.slice(0, 200) }, "AI vision parse failed");
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //                ERP — EXPIRATION RISK ANALYSIS
  // ═══════════════════════════════════════════════════════════

  /**
   * Analiza lotes próximos a vencer y sugiere acciones (promoción, plato del día, donación).
   */
  async analyzeExpirationRisk(input: {
    lots: { ingredientName: string; qty: number; unit: string; daysToExpire: number; valueCents: number }[];
    avgDailyConsumption?: { name: string; qtyPerDay: number }[];
  }): Promise<{
    overall: "low" | "medium" | "high" | "critical";
    risks: { ingredient: string; risk: "low" | "medium" | "high" | "critical"; expectedWasteCents: number; suggestion: string }[];
    summary: string;
  } | null> {
    if (!this.enabled) {
      // Heuristic fallback
      const risks = input.lots.map(l => {
        const consumption = input.avgDailyConsumption?.find(c => c.name === l.ingredientName);
        const willConsumeBeforeExpiry = consumption ? consumption.qtyPerDay * l.daysToExpire >= l.qty : null;
        const risk = l.daysToExpire <= 1 ? "critical" : l.daysToExpire <= 2 ? "high" : l.daysToExpire <= 4 ? "medium" : "low";
        return {
          ingredient: l.ingredientName,
          risk: risk as any,
          expectedWasteCents: willConsumeBeforeExpiry === false ? l.valueCents : 0,
          suggestion: l.daysToExpire <= 2
            ? `Promocionar platos con ${l.ingredientName} hoy mismo`
            : `Monitorear consumo de ${l.ingredientName}`
        };
      });
      const overall = risks.some(r => r.risk === "critical") ? "critical" : risks.some(r => r.risk === "high") ? "high" : "low";
      return { overall: overall as any, risks, summary: `${risks.length} lotes próximos a vencer` };
    }

    const text = await this.callClaude({
      system: `Eres consultor de operaciones para una pollería peruana. Analiza riesgo de merma por caducidad y recomienda acciones específicas. Responde SOLO JSON con esta forma:
{
  "overall": "low|medium|high|critical",
  "risks": [{"ingredient":"...","risk":"...","expectedWasteCents": 0, "suggestion": "frase corta accionable en español"}],
  "summary": "una frase resumen"
}`,
      messages: [{ role: "user", content: JSON.stringify(input) }],
      maxTokens: 1200,
      temperature: 0.2
    });
    try {
      return text ? JSON.parse(text.replace(/```json\s*|\s*```/g, "").trim()) : null;
    } catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //                MARKETING — CAMPAIGN SUGGESTIONS
  // ═══════════════════════════════════════════════════════════

  /**
   * Sugiere campañas inteligentes basándose en data del negocio.
   */
  async suggestCampaigns(input: {
    lowRotationItems: { name: string; soldLast30d: number; marginPct: number; menuItemId: string }[];
    expiringIngredients: { name: string; daysToExpire: number; qty: number; unit: string }[];
    offHours: { hour: string; ordersAvg: number; benchmarkAvg: number }[];
    customerSegments: { segment: string; count: number; avgTicketCents: number; lastVisitDays: number }[];
    upcomingNationalDates: { date: string; name: string; relevance: string }[];
    topMarginItems: { name: string; marginPct: number; menuItemId: string }[];
  }): Promise<Array<{
    title: string;
    hook: string;
    body: string;
    type: "DISCOUNT" | "BUNDLE" | "EVENT" | "LOW_ROTATION" | "OFF_HOUR" | "NATIONAL_DAY" | "SEASONAL" | "LOYALTY";
    rationale: string;
    targetItems: string[];
    targetAudience: "ALL" | "NEW" | "RETURNING" | "VIP" | "RIESGO_FUGA";
    expectedRevenueLiftCents: number;
    expectedMarginImpact: number;
    validFrom: string | null;
    validUntil: string | null;
  }> | null> {
    if (!this.enabled) {
      return this.fallbackCampaigns(input);
    }
    const text = await this.callClaude({
      system: `Eres estratega de marketing para restaurantes peruanos con visión de negocio. Tu objetivo: maximizar margen y ventas usando data real del restaurante.

Genera 4 a 6 campañas concretas y diversas. Mezcla tipos: aprovecha insumos en baja rotación o por vencer, usa fechas nacionales peruanas (Día del Pollo a la Brasa = 3er domingo de julio, Día del Pisco Sour = 1er sábado de febrero, Fiestas Patrias = 28-29 julio, Día de la Madre/Padre, Halloween, Navidad, Año Nuevo), aprovecha horas valle, y crea programas de retención para clientes en riesgo de fuga.

Cada campaña debe tener:
- Hook corto (≤8 palabras, atractivo)
- Body con copy persuasivo en español peruano natural
- Rationale claro basado en la data
- Items objetivo (menuItemIds del input)
- Estimación honesta de revenue lift y margin impact

Devuelve SOLO JSON array con esta forma exacta:
[{
  "title": "Nombre interno corto",
  "hook": "Hook marketing visible",
  "body": "Copy completo de campaña, 1-2 oraciones",
  "type": "DISCOUNT|BUNDLE|EVENT|LOW_ROTATION|OFF_HOUR|NATIONAL_DAY|SEASONAL|LOYALTY",
  "rationale": "por qué la AI la sugiere, basado en la data",
  "targetItems": ["menuItemId1", ...],
  "targetAudience": "ALL|NEW|RETURNING|VIP|RIESGO_FUGA",
  "expectedRevenueLiftCents": 0,
  "expectedMarginImpact": 0.0,
  "validFrom": "ISO date or null",
  "validUntil": "ISO date or null"
}]`,
      messages: [{ role: "user", content: JSON.stringify(input) }],
      maxTokens: 3500,
      temperature: 0.7
    });
    try {
      return text ? JSON.parse(text.replace(/```json\s*|\s*```/g, "").trim()) : null;
    } catch (err) {
      logger.warn({ err }, "Campaign parse failed");
      return this.fallbackCampaigns(input);
    }
  }

  /**
   * Fallback rule-based campaigns if AI not enabled.
   */
  private fallbackCampaigns(input: any) {
    const out: any[] = [];

    if (input.lowRotationItems?.length > 0) {
      const items = input.lowRotationItems.slice(0, 2);
      out.push({
        title: "Activar lo que no se mueve",
        hook: "2 × 1 en platos seleccionados",
        body: `Esta semana lleva 2 ${items.map((i: any) => i.name).join(" / ")} al precio de uno. Solo de lunes a miércoles.`,
        type: "LOW_ROTATION",
        rationale: `${items.length} platos con ventas bajas en últimos 30 días`,
        targetItems: items.map((i: any) => i.menuItemId),
        targetAudience: "ALL",
        expectedRevenueLiftCents: 80000,
        expectedMarginImpact: -0.05,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 7 * 86400000).toISOString()
      });
    }

    if (input.expiringIngredients?.length > 0) {
      out.push({
        title: "Plato del día con insumos a vencer",
        hook: "Especial del chef · 25% off",
        body: "Plato fresco de hoy con descuento mientras dure el stock.",
        type: "SEASONAL",
        rationale: `${input.expiringIngredients.length} insumos vencen en pocos días`,
        targetItems: [],
        targetAudience: "ALL",
        expectedRevenueLiftCents: 30000,
        expectedMarginImpact: 0.10,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 2 * 86400000).toISOString()
      });
    }

    if (input.customerSegments?.find((s: any) => s.segment === "RIESGO_FUGA")) {
      out.push({
        title: "Te extrañamos",
        hook: "S/ 20 de regalo en tu próxima visita",
        body: "Hola, ¿hace cuánto que no te vemos? Te dejamos S/ 20 de saldo válido por 14 días.",
        type: "LOYALTY",
        rationale: "Clientes con > 60 días sin visita",
        targetItems: [],
        targetAudience: "RIESGO_FUGA",
        expectedRevenueLiftCents: 50000,
        expectedMarginImpact: 0.0,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 14 * 86400000).toISOString()
      });
    }

    return out;
  }

}

export const aiService = new AIService();
