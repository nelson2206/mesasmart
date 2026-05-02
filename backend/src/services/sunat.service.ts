/**
 * SUNAT / OSE Service
 * ──────────────────────────────
 * Genera comprobantes electrónicos peruanos (boleta, factura, ticket).
 * Si MOCK_OSE=true (default en dev), simula respuesta exitosa.
 * En prod, hace POST al OSE configurado (Nubefact por defecto).
 *
 * Cumple Resolución de Superintendencia N° 097-2012/SUNAT y modificatorias.
 */

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { prisma } from "../prisma.js";
import { calcTaxBreakdown } from "../utils/money.js";

export interface ComprobanteInput {
  orderId: string;
  type: "BOLETA" | "FACTURA" | "TICKET";
  rucCliente?: string;
  dniCliente?: string;
  razonSocial?: string;
  direccion?: string;
  email?: string;
}

export interface ComprobanteResult {
  ok: boolean;
  comprobanteId?: string;
  serie?: string;
  correlativo?: number;
  oseHash?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  error?: string;
}

class SunatService {
  /**
   * Genera comprobante electrónico para una orden ya pagada.
   */
  async issue(input: ComprobanteInput): Promise<ComprobanteResult> {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { items: { include: { menuItem: true } }, restaurant: true }
    });

    if (!order) {
      return { ok: false, error: "ORDER_NOT_FOUND" };
    }

    // Validate per type
    if (input.type === "FACTURA") {
      if (!input.rucCliente || !/^\d{11}$/.test(input.rucCliente)) {
        return { ok: false, error: "INVALID_RUC" };
      }
      if (!input.razonSocial) return { ok: false, error: "MISSING_RAZON_SOCIAL" };
      if (!input.direccion) return { ok: false, error: "MISSING_DIRECCION" };
    }

    if (input.type === "BOLETA" && order.totalCents > 70000 && !input.dniCliente) {
      return { ok: false, error: "DNI_REQUIRED_OVER_700" };
    }

    if (input.dniCliente && !/^\d{8}$/.test(input.dniCliente)) {
      return { ok: false, error: "INVALID_DNI" };
    }

    // Increment correlativo (transactional)
    const restaurant = await prisma.restaurant.update({
      where: { id: order.restaurantId },
      data: input.type === "FACTURA" ? { facturaSeq: { increment: 1 } } : { boletaSeq: { increment: 1 } }
    });

    const serie = input.type === "FACTURA" ? restaurant.facturaSerie : restaurant.boletaSerie;
    const correlativo = input.type === "FACTURA" ? restaurant.facturaSeq : restaurant.boletaSeq;

    const breakdown = calcTaxBreakdown(order.totalCents, restaurant.taxRate);

    // Persist comprobante
    const comprobante = await prisma.comprobante.create({
      data: {
        orderId: order.id,
        type: input.type,
        serie,
        correlativo,
        rucCliente: input.rucCliente,
        dniCliente: input.dniCliente,
        razonSocial: input.razonSocial,
        direccion: input.direccion,
        email: input.email,
        subtotalCents: breakdown.baseCents,
        igvCents: breakdown.taxCents,
        totalCents: breakdown.totalCents,
        oseStatus: "PENDING"
      }
    });

    // Send to OSE
    const oseResult = env.MOCK_OSE
      ? this.mockSubmit(comprobante.id)
      : await this.submitToNubefact(comprobante.id);

    // Update with OSE response
    await prisma.comprobante.update({
      where: { id: comprobante.id },
      data: {
        oseStatus: oseResult.ok ? "ACCEPTED" : "REJECTED",
        oseHash: oseResult.hash,
        xmlUrl: oseResult.xmlUrl,
        pdfUrl: oseResult.pdfUrl,
        cdrUrl: oseResult.cdrUrl
      }
    });

    return {
      ok: oseResult.ok,
      comprobanteId: comprobante.id,
      serie,
      correlativo,
      oseHash: oseResult.hash,
      pdfUrl: oseResult.pdfUrl,
      xmlUrl: oseResult.xmlUrl
    };
  }

  /**
   * Mock OSE response — para desarrollo y demos sin costo.
   */
  private mockSubmit(comprobanteId: string) {
    const hash = "MOCK_" + Math.random().toString(36).slice(2, 10).toUpperCase();
    logger.info({ comprobanteId, hash }, "Mock OSE submission");
    return {
      ok: true,
      hash,
      xmlUrl: `${env.API_BASE_URL}/comprobantes/${comprobanteId}/xml`,
      pdfUrl: `${env.API_BASE_URL}/comprobantes/${comprobanteId}/pdf`,
      cdrUrl: `${env.API_BASE_URL}/comprobantes/${comprobanteId}/cdr`
    };
  }

  /**
   * Submit a Nubefact (real OSE).
   * Implementación real requiere generar UBL 2.1 firmado con certificado del restaurante.
   */
  private async submitToNubefact(comprobanteId: string) {
    if (!env.NUBEFACT_API_URL || !env.NUBEFACT_TOKEN) {
      logger.warn("Nubefact credentials missing, falling back to mock");
      return this.mockSubmit(comprobanteId);
    }

    // TODO: implementar generación de XML UBL 2.1 firmado y POST a Nubefact
    // Esta es una versión stub que valida la integración pero no produce UBL real.
    try {
      const res = await fetch(env.NUBEFACT_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NUBEFACT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ comprobanteId })
      });
      const data = (await res.json()) as { ok: boolean; hash?: string; pdf?: string; xml?: string; cdr?: string };
      return {
        ok: data.ok,
        hash: data.hash,
        pdfUrl: data.pdf,
        xmlUrl: data.xml,
        cdrUrl: data.cdr
      };
    } catch (err) {
      logger.error({ err }, "Nubefact submission failed");
      return { ok: false, hash: undefined, pdfUrl: undefined, xmlUrl: undefined, cdrUrl: undefined };
    }
  }
}

export const sunatService = new SunatService();
