/**
 * MesaSmart · Loss Prevention · Servicio IA
 * ─────────────────────────────────────────
 * Analiza frames de cámaras usando Claude Vision (cuando hay API key)
 * o devuelve heurísticas determinísticas (mock realista) en dev.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export type SecurityAlertType =
  | "FAKE_RECEIPT"
  | "THEFT_INVENTORY"
  | "OPEN_REGISTER_NO_TX"
  | "UNUSUAL_AREA"
  | "UNRECORDED_CONSUMPTION"
  | "TAMPERING"
  | "MANUAL_FLAG";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AnalyzeFrameInput {
  imageBase64: string;
  cameraLocation: string;            // CAJA | COCINA | SALON | etc
  context?: string;                  // texto adicional del POS (ej: "no hay tx abierta en POS")
  detectionRules: SecurityAlertType[]; // qué tipos de evento buscar
}

export interface AnalyzeFrameResult {
  alertDetected: boolean;
  type?: SecurityAlertType;
  severity?: Severity;
  title?: string;
  description?: string;
  rationale?: string;
  confidence?: number;        // 0..1
  estimatedLossCents?: number;
  source: "claude-vision" | "mock";
}

/**
 * Analiza un frame y devuelve si hay alerta + tipo + severidad + razón
 */
export async function analyzeFrame(input: AnalyzeFrameInput): Promise<AnalyzeFrameResult> {
  // Si no hay API key o feature off → mock determinístico
  if (!env.ANTHROPIC_API_KEY || !env.AI_FEATURES_ENABLED) {
    return mockAnalysis(input);
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    const promptInstructions = buildPrompt(input);
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: input.imageBase64.replace(/^data:image\/\w+;base64,/, "")
              }
            },
            { type: "text", text: promptInstructions }
          ]
        }
      ]
    });

    const text = response.content
      .filter(c => c.type === "text")
      .map(c => (c as any).text)
      .join("\n");

    const parsed = parseAiResponse(text);
    return { ...parsed, source: "claude-vision" };
  } catch (err) {
    logger.warn({ err }, "Claude Vision analysis failed, falling back to mock");
    return mockAnalysis(input);
  }
}

function buildPrompt(input: AnalyzeFrameInput): string {
  const rules = {
    FAKE_RECEIPT: "Empleado entrega al cliente un papel en blanco o sin logo SUNAT/QR/series oficiales en lugar de boleta válida.",
    THEFT_INVENTORY: "Empleado toma insumo del inventario y lo lleva fuera del área de trabajo o lo guarda en bolsa personal.",
    OPEN_REGISTER_NO_TX: "Caja abierta sin que haya transacción registrada en el POS.",
    UNUSUAL_AREA: "Empleado en área no autorizada según su rol (ej: mozo en bóveda, cocinero en oficina).",
    UNRECORDED_CONSUMPTION: "Empleado consume comida/bebida del inventario sin registro.",
    TAMPERING: "Manipulación de cámara, etiquetas, o registros físicos sospechosa.",
    MANUAL_FLAG: "Otro comportamiento sospechoso digno de revisión humana."
  };

  const enabledRules = input.detectionRules.map(t => `- ${t}: ${rules[t]}`).join("\n");

  return `Eres un sistema de Loss Prevention para restaurantes peruanos. Analizas un frame de una cámara de seguridad ubicada en: **${input.cameraLocation}**.
${input.context ? `\n**Contexto adicional del POS:** ${input.context}\n` : ""}
**Comportamientos sospechosos a detectar:**
${enabledRules}

Si NO observas ninguno de los anteriores con razonable confianza, responde EXACTAMENTE:
\`\`\`json
{ "alertDetected": false }
\`\`\`

Si SÍ detectas algo sospechoso, responde EXACTAMENTE en este formato JSON:
\`\`\`json
{
  "alertDetected": true,
  "type": "FAKE_RECEIPT" | "THEFT_INVENTORY" | "OPEN_REGISTER_NO_TX" | "UNUSUAL_AREA" | "UNRECORDED_CONSUMPTION" | "TAMPERING" | "MANUAL_FLAG",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "title": "Resumen breve en 1 línea (máx 80 chars)",
  "description": "Descripción factual de lo observado, sin acusar (máx 240 chars)",
  "rationale": "Razón técnica concreta (qué viste en el frame que disparó la alerta)",
  "confidence": 0.85,
  "estimatedLossCents": 0
}
\`\`\`
Responde SOLO el JSON, sin texto adicional. No acuses ni juzgues — describe lo observado.`;
}

function parseAiResponse(text: string): Omit<AnalyzeFrameResult, "source"> {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { alertDetected: false };
    const obj = JSON.parse(match[0]);
    if (!obj.alertDetected) return { alertDetected: false };
    return {
      alertDetected: true,
      type: obj.type,
      severity: obj.severity || "MEDIUM",
      title: obj.title || "Comportamiento sospechoso detectado",
      description: obj.description || "",
      rationale: obj.rationale || "",
      confidence: typeof obj.confidence === "number" ? obj.confidence : 0.7,
      estimatedLossCents: obj.estimatedLossCents || 0
    };
  } catch {
    return { alertDetected: false };
  }
}

/**
 * Mock determinístico — devuelve un evento "creíble" según la ubicación de la cámara
 * Útil para demos sin costo de API.
 */
function mockAnalysis(input: AnalyzeFrameInput): AnalyzeFrameResult {
  // Simulamos ~70% de frames sin alerta y 30% con alerta para que el demo sea interesante
  const r = Math.random();
  if (r < 0.7) {
    return { alertDetected: false, source: "mock" };
  }

  // Tipo de alerta plausible según ubicación
  let type: SecurityAlertType;
  let title = "";
  let description = "";
  let severity: Severity = "MEDIUM";
  let estimatedLossCents = 0;

  switch (input.cameraLocation) {
    case "CAJA":
      type = r < 0.85 ? "FAKE_RECEIPT" : "OPEN_REGISTER_NO_TX";
      if (type === "FAKE_RECEIPT") {
        title = "Posible papel en blanco entregado al cliente";
        description = "El cajero entregó al cliente un papel que no presenta los elementos típicos de una boleta SUNAT (QR, series, logo). Validar contra POS si la transacción fue registrada.";
        severity = "HIGH";
        estimatedLossCents = 4500 + Math.floor(Math.random() * 8000);
      } else {
        title = "Caja abierta sin transacción registrada";
        description = "Cajón de la caja registradora abierto durante 12 segundos sin que se observe transacción correspondiente en el POS.";
        severity = "MEDIUM";
        estimatedLossCents = 2000 + Math.floor(Math.random() * 5000);
      }
      break;
    case "COCINA":
      type = "UNRECORDED_CONSUMPTION";
      title = "Consumo de insumo sin registro";
      description = "Empleado consumió bebida del refrigerador sin registrarla en el sistema de mermas o consumos personales.";
      severity = "LOW";
      estimatedLossCents = 800 + Math.floor(Math.random() * 1500);
      break;
    case "ALMACEN":
      type = "THEFT_INVENTORY";
      title = "Insumo retirado en bolsa personal";
      description = "Empleado tomó botella del estante y la guardó en su mochila personal. Validar contra movimiento de inventario autorizado.";
      severity = "CRITICAL";
      estimatedLossCents = 8500 + Math.floor(Math.random() * 12000);
      break;
    case "PUERTA_TRASERA":
      type = "THEFT_INVENTORY";
      title = "Salida sospechosa por puerta trasera";
      description = "Empleado salió por puerta de servicio cargando bolsa de tamaño inusual a las 21:48, fuera de horario de despacho de proveedores.";
      severity = "HIGH";
      estimatedLossCents = 12000 + Math.floor(Math.random() * 18000);
      break;
    case "BARRA":
      type = "UNRECORDED_CONSUMPTION";
      title = "Bartender sirvió bebida no registrada";
      description = "Bartender sirvió 2 tragos a personas en la barra sin que aparezca comanda asociada en el POS para esas posiciones.";
      severity = "MEDIUM";
      estimatedLossCents = 3500 + Math.floor(Math.random() * 4500);
      break;
    case "SALON":
      type = "UNUSUAL_AREA";
      title = "Empleado en área no asignada";
      description = "Empleado de cocina permaneció 4+ minutos en área de mesas vacías sin tarea aparente.";
      severity = "LOW";
      estimatedLossCents = 0;
      break;
    default:
      type = "MANUAL_FLAG";
      title = "Comportamiento atípico detectado";
      description = "Patrón de movimiento inusual detectado por el modelo. Recomendable revisión manual.";
      severity = "LOW";
  }

  return {
    alertDetected: true,
    type,
    severity,
    title,
    description,
    rationale: `Mock determinístico (sin Claude Vision API). Cámara ${input.cameraLocation}. Reglas habilitadas: ${input.detectionRules.join(", ")}`,
    confidence: 0.65 + Math.random() * 0.3,
    estimatedLossCents,
    source: "mock"
  };
}
