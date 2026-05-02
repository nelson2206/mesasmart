import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { inventoryService } from "../services/inventory.service.js";
import { aiService } from "../services/ai.service.js";

export const goodsReceiptRoutes = Router();

// ─── GET: List goods receipts ───────────────────────────────────
goodsReceiptRoutes.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const where: any = { restaurantId: req.user!.restaurantId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.supplierId) where.supplierId = req.query.supplierId;

    const receipts = await prisma.goodsReceipt.findMany({
      where,
      include: { supplier: true, lines: { include: { ingredient: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(receipts);
  })
);

// ─── GET: Single receipt ────────────────────────────────────────
goodsReceiptRoutes.get(
  "/:id",
  authRequired,
  asyncHandler(async (req, res) => {
    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: req.params.id },
      include: { supplier: true, lines: { include: { ingredient: true } } }
    });

    if (!receipt || receipt.restaurantId !== req.user!.restaurantId) {
      throw new HttpError(404, "receipt_not_found");
    }

    res.json(receipt);
  })
);

// ─── POST: Create receipt ───────────────────────────────────────
const createReceiptSchema = z.object({
  supplierId: z.string(),
  purchaseOrderId: z.string().optional(),
  guideNumber: z.string(),
  guideUrl: z.string().url().optional(),
  lines: z.array(
    z.object({
      ingredientId: z.string(),
      qtyOrdered: z.number().positive().optional(),
      qtyReceived: z.number().positive(),
      qtyAccepted: z.number().positive(),
      unitCostCents: z.number().int().positive(),
      expirationDate: z.string().datetime().optional(),
      lotNumber: z.string().optional(),
      notes: z.string().optional()
    })
  ),
  notes: z.string().optional()
});

goodsReceiptRoutes.post(
  "/",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createReceiptSchema.parse(req.body);

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId }
    });
    if (!supplier || supplier.restaurantId !== req.user!.restaurantId) {
      throw new HttpError(400, "supplier_not_found");
    }

    // Calculate total
    const totalCents = data.lines.reduce((sum, line) => sum + (line.qtyAccepted * line.unitCostCents), 0);

    const receipt = await prisma.goodsReceipt.create({
      data: {
        restaurantId: req.user!.restaurantId,
        supplierId: data.supplierId,
        purchaseOrderId: data.purchaseOrderId,
        guideNumber: data.guideNumber,
        guideUrl: data.guideUrl,
        status: "PENDING_REVIEW",
        totalCents,
        notes: data.notes,
        receivedBy: req.user!.userId,
        lines: {
          create: data.lines.map(line => ({
            ingredientId: line.ingredientId,
            qtyOrdered: line.qtyOrdered,
            qtyReceived: line.qtyReceived,
            qtyAccepted: line.qtyAccepted,
            unitCostCents: line.unitCostCents,
            expirationDate: line.expirationDate ? new Date(line.expirationDate) : undefined,
            lotNumber: line.lotNumber,
            notes: line.notes
          }))
        }
      },
      include: { supplier: true, lines: { include: { ingredient: true } } }
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        action: "CREATE_GOODS_RECEIPT",
        entityType: "GoodsReceipt",
        entityId: receipt.id,
        after: JSON.stringify({ guideNumber: receipt.guideNumber, totalCents: receipt.totalCents })
      }
    });

    res.status(201).json(receipt);
  })
);

// ─── POST: Confirm receipt (apply to inventory) ──────────────────
const confirmReceiptSchema = z.object({
  discrepancyNotes: z.string().optional()
});

goodsReceiptRoutes.post(
  "/:id/confirm",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { discrepancyNotes } = z.object({
      discrepancyNotes: z.string().optional()
    }).parse(req.body);

    const receipt = await prisma.goodsReceipt.findUnique({
      where: { id: req.params.id },
      include: { lines: true }
    });

    if (!receipt || receipt.restaurantId !== req.user!.restaurantId) {
      throw new HttpError(404, "receipt_not_found");
    }

    if (receipt.status !== "PENDING_REVIEW") {
      throw new HttpError(400, "invalid_status", "Receipt must be in PENDING_REVIEW status");
    }

    // Apply each line to inventory
    for (const line of receipt.lines) {
      await inventoryService.addStock({
        ingredientId: line.ingredientId,
        qty: line.qtyAccepted,
        unitCostCents: line.unitCostCents,
        type: "PURCHASE",
        refType: "GOODS_RECEIPT",
        refId: receipt.id,
        expirationDate: line.expirationDate || undefined,
        userId: req.user!.userId,
        notes: `Recepción: Guía ${receipt.guideNumber}${line.lotNumber ? ` Lote ${line.lotNumber}` : ""}`
      });
    }

    const status = discrepancyNotes ? "DISCREPANCY" : "CONFIRMED";
    const updated = await prisma.goodsReceipt.update({
      where: { id: receipt.id },
      data: { status, notes: discrepancyNotes ? `${receipt.notes || ""}\n[DISCREPANCIA] ${discrepancyNotes}` : receipt.notes },
      include: { supplier: true, lines: { include: { ingredient: true } } }
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        action: "CONFIRM_GOODS_RECEIPT",
        entityType: "GoodsReceipt",
        entityId: receipt.id,
        reason: discrepancyNotes || "Confirmación normal",
        after: JSON.stringify({ status, linesProcessed: receipt.lines.length })
      }
    });

    res.json(updated);
  })
);

// ─── POST: Extract from photo (AI Vision) ──────────────────────
const extractPhotoSchema = z.object({
  imageBase64: z.string(),
  supplierId: z.string(),
  expectedIngredients: z.array(z.string()).optional()
});

goodsReceiptRoutes.post(
  "/extract-from-photo",
  authRequired,
  asyncHandler(async (req, res) => {
    const { imageBase64, supplierId, expectedIngredients } = extractPhotoSchema.parse(req.body);

    // Get expected ingredients if not provided
    let expectedNames: string[] = [];
    if (expectedIngredients && expectedIngredients.length > 0) {
      const ings = await prisma.ingredient.findMany({
        where: { id: { in: expectedIngredients } },
        select: { name: true }
      });
      expectedNames = ings.map(i => i.name);
    }

    // Call AI to extract items
    const extracted = await aiService.extractFromGoodsReceiptPhoto(
      imageBase64,
      expectedNames
    );

    if (!extracted) {
      return res.status(503).json({
        error: "ai_unavailable",
        message: "AI features not available, please fill manually"
      });
    }

    // Map extracted items to ingredient IDs
    const ings = await prisma.ingredient.findMany({
      where: { restaurantId: req.user!.restaurantId },
      select: { id: true, name: true }
    });
    const nameMap = new Map(ings.map(i => [i.name.toLowerCase(), i.id]));

    const lines = extracted.items.map(item => ({
      ingredientId: nameMap.get(item.name.toLowerCase()) || null,
      qtyReceived: item.quantity,
      qtyAccepted: item.quantity,
      unitCostCents: Math.round(item.unitPrice * 100),
      expirationDate: item.expirationDate ? new Date(item.expirationDate) : undefined,
      lotNumber: item.lotNumber,
      notes: `Extraído de foto: ${item.name}`
    })).filter(l => l.ingredientId); // Only include matched ingredients

    res.json({
      success: true,
      itemsExtracted: lines.length,
      lines
    });
  })
);
