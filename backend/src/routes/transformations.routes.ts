import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/error.js";
import { inventoryService } from "../services/inventory.service.js";

export const transformationRoutes = Router();

// ─── GET: List transformations ───────────────────────────────────
transformationRoutes.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const transformations = await prisma.ingredientTransformation.findMany({
      where: { restaurantId: req.user!.restaurantId, active: true },
      include: {
        fromIngredient: true,
        toIngredient: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(transformations);
  })
);

// ─── GET: Yield report (expected vs actual) ──────────────────────
transformationRoutes.get(
  "/yields",
  authRequired,
  asyncHandler(async (req, res) => {
    const transformations = await prisma.ingredientTransformation.findMany({
      where: { restaurantId: req.user!.restaurantId, active: true },
      include: {
        fromIngredient: true,
        toIngredient: true,
        executions: { orderBy: { executedAt: "desc" }, take: 20 }
      }
    });

    const report = transformations.map(t => {
      const executions = t.executions || [];
      const totalExecutions = executions.length;
      const avgYield = executions.length > 0
        ? executions.reduce((sum, e) => sum + e.actualYieldPct, 0) / executions.length
        : null;
      const variance = avgYield ? (avgYield - t.yieldPct) : null;
      const alert = variance && Math.abs(variance) > 5 ? "HIGH" : variance && Math.abs(variance) > 2 ? "MEDIUM" : null;

      return {
        id: t.id,
        fromIngredient: t.fromIngredient.name,
        toIngredient: t.toIngredient.name,
        expectedYieldPct: t.yieldPct,
        actualYieldPct: avgYield,
        variance,
        totalExecutions,
        lastExecution: executions[0]?.executedAt || null,
        alert,
        laborMinutes: t.laborMinutes,
        laborCostCents: t.laborCostCents
      };
    });

    res.json(report);
  })
);

// ─── POST: Create transformation ─────────────────────────────────
const createTransformSchema = z.object({
  fromIngredientId: z.string(),
  toIngredientId: z.string(),
  inputQty: z.number().positive(),
  outputQty: z.number().positive(),
  laborMinutes: z.number().int().nonnegative().default(0),
  laborCostCents: z.number().int().nonnegative().default(0),
  station: z.string().optional(),
  notes: z.string().optional()
});

transformationRoutes.post(
  "/",
  authRequired,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createTransformSchema.parse(req.body);

    // Verify both ingredients exist
    const [fromIng, toIng] = await Promise.all([
      prisma.ingredient.findUnique({ where: { id: data.fromIngredientId } }),
      prisma.ingredient.findUnique({ where: { id: data.toIngredientId } })
    ]);

    if (!fromIng || !toIng) {
      throw new HttpError(400, "ingredient_not_found", "One or both ingredients not found");
    }

    const yieldPct = (data.outputQty / data.inputQty) * 100;

    const transformation = await prisma.ingredientTransformation.create({
      data: {
        restaurantId: req.user!.restaurantId,
        fromIngredientId: data.fromIngredientId,
        toIngredientId: data.toIngredientId,
        inputQty: data.inputQty,
        outputQty: data.outputQty,
        yieldPct,
        laborMinutes: data.laborMinutes,
        laborCostCents: data.laborCostCents,
        station: data.station,
        notes: data.notes
      },
      include: { fromIngredient: true, toIngredient: true }
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        action: "CREATE_TRANSFORMATION",
        entityType: "IngredientTransformation",
        entityId: transformation.id,
        after: JSON.stringify(transformation)
      }
    });

    res.status(201).json(transformation);
  })
);

// ─── POST: Execute transformation ────────────────────────────────
const executeTransformSchema = z.object({
  transformationId: z.string(),
  inputQty: z.number().positive(),
  reason: z.string().optional()
});

transformationRoutes.post(
  "/execute",
  authRequired,
  requireRole("ADMIN", "KITCHEN"),
  asyncHandler(async (req, res) => {
    const data = executeTransformSchema.parse(req.body);

    const transformation = await prisma.ingredientTransformation.findUnique({
      where: { id: data.transformationId },
      include: { fromIngredient: true, toIngredient: true }
    });

    if (!transformation) {
      throw new HttpError(404, "transformation_not_found");
    }

    // Calculate output based on input
    const outputQty = (data.inputQty / transformation.inputQty) * transformation.outputQty;
    const actualYieldPct = (outputQty / data.inputQty) * 100;

    // Step 1: Deduct input ingredient
    await inventoryService.adjustStock({
      ingredientId: transformation.fromIngredientId,
      newQty: transformation.fromIngredient.currentStock - data.inputQty,
      reason: `Transformation: ${data.inputQty} ${transformation.fromIngredient.unit} → ${transformation.toIngredient.name}`,
      userId: req.user!.userId
    });

    // Step 2: Add output ingredient with labor cost included
    const totalLaborCostCents = Math.round(
      data.inputQty * (transformation.laborCostCents / transformation.inputQty)
    );
    const unitCostCents = Math.round(
      transformation.fromIngredient.avgCostPerUnitCents +
      (totalLaborCostCents / outputQty)
    );

    await inventoryService.addStock({
      ingredientId: transformation.toIngredientId,
      qty: outputQty,
      unitCostCents,
      type: "ADJUSTMENT",
      refType: "TRANSFORMATION",
      refId: transformation.id,
      userId: req.user!.userId,
      notes: `From: ${data.inputQty} ${transformation.fromIngredient.unit} ${transformation.fromIngredient.name}. Labor: ${Math.round(transformation.laborMinutes * data.inputQty / transformation.inputQty)}min`
    });

    // Step 3: Record execution for yield tracking
    const execution = await prisma.transformationExecution.create({
      data: {
        transformationId: transformation.id,
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        inputQty: data.inputQty,
        outputQty,
        actualYieldPct
      }
    });

    // Step 4: Audit
    await prisma.auditLog.create({
      data: {
        restaurantId: req.user!.restaurantId,
        userId: req.user!.userId,
        action: "EXECUTE_TRANSFORMATION",
        entityType: "TransformationExecution",
        entityId: execution.id,
        reason: data.reason,
        after: JSON.stringify({ inputQty: data.inputQty, outputQty, actualYieldPct })
      }
    });

    res.status(201).json({
      success: true,
      execution: {
        ...execution,
        fromIngredient: transformation.fromIngredient,
        toIngredient: transformation.toIngredient,
        expectedYieldPct: transformation.yieldPct
      }
    });
  })
);
