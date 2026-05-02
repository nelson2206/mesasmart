import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { sockets } from "../sockets/index.js";
import { sunatService } from "../services/sunat.service.js";
import { env } from "../config/env.js";

export const paymentRoutes = Router();

const paySchema = z.object({
  method: z.enum(["YAPE", "PLIN", "CARD", "CASH", "TRANSFER"]),
  comprobante: z.object({
    type: z.enum(["BOLETA", "FACTURA", "TICKET"]),
    rucCliente: z.string().optional(),
    dniCliente: z.string().optional(),
    razonSocial: z.string().optional(),
    direccion: z.string().optional(),
    email: z.string().email().optional()
  })
});

paymentRoutes.post(
  "/orders/:id/payment",
  authRequired,
  asyncHandler(async (req, res) => {
    const { method, comprobante } = paySchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { restaurant: true }
    });
    if (!order) throw new HttpError(404, "order_not_found");
    if (order.status === "PAID") throw new HttpError(409, "already_paid");
    if (order.totalCents === 0) throw new HttpError(400, "checkout_first");

    // 1. Process payment (mocked for now)
    const externalId = env.MOCK_PAYMENTS
      ? `MOCK_${method}_${Date.now()}`
      : await processRealPayment(method, order.totalCents);

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        method,
        amountCents: order.totalCents,
        tipCents: order.tipCents,
        status: "CONFIRMED",
        externalId,
        confirmedAt: new Date()
      }
    });

    // 2. Issue comprobante via SUNAT/OSE
    const sunatResult = await sunatService.issue({
      orderId: order.id,
      type: comprobante.type,
      rucCliente: comprobante.rucCliente,
      dniCliente: comprobante.dniCliente,
      razonSocial: comprobante.razonSocial,
      direccion: comprobante.direccion,
      email: comprobante.email
    });

    if (!sunatResult.ok) {
      throw new HttpError(400, "comprobante_failed", sunatResult.error ?? "OSE rejected");
    }

    // 3. Mark order as paid + free table
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), closedAt: new Date() }
    });
    await prisma.table.update({
      where: { id: order.tableId },
      data: { status: "FREE" }
    });

    sockets.toOrder(order.restaurantId, order.id, "payment:processed", { orderId: order.id, comprobanteId: sunatResult.comprobanteId });
    sockets.toRole(order.restaurantId, "ADMIN", "order:status", { orderId: order.id, status: "PAID" });

    res.status(201).json({
      payment,
      comprobante: {
        id: sunatResult.comprobanteId,
        serie: sunatResult.serie,
        correlativo: sunatResult.correlativo,
        oseHash: sunatResult.oseHash,
        pdfUrl: sunatResult.pdfUrl,
        xmlUrl: sunatResult.xmlUrl
      }
    });
  })
);

// Mock real-payment integration stub
async function processRealPayment(method: string, _amountCents: number): Promise<string> {
  // TODO: integrate with Culqi / Niubiz / Yape Empresa / Plin BCP
  return `${method}_LIVE_${Date.now()}`;
}

// Get comprobante metadata
paymentRoutes.get(
  "/comprobantes/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const c = await prisma.comprobante.findUnique({
      where: { id: req.params.id },
      include: { order: { include: { items: { include: { menuItem: true } }, table: true } } }
    });
    if (!c) throw new HttpError(404, "not_found");
    res.json(c);
  })
);
