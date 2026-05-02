/**
 * MesaSmart · Backend entry point
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { initSockets } from "./sockets/index.js";

import { authRoutes } from "./routes/auth.routes.js";
import { menuRoutes } from "./routes/menu.routes.js";
import { tableRoutes } from "./routes/tables.routes.js";
import { orderRoutes } from "./routes/orders.routes.js";
import { modRoutes } from "./routes/modifications.routes.js";
import { callRoutes } from "./routes/calls.routes.js";
import { paymentRoutes } from "./routes/payments.routes.js";
import { reportRoutes } from "./routes/reports.routes.js";
import { aiRoutes } from "./routes/ai.routes.js";
import { ingredientRoutes } from "./routes/ingredients.routes.js";
import { recipeRoutes } from "./routes/recipes.routes.js";
import { inventoryRoutes } from "./routes/inventory.routes.js";
import { supplierRoutes } from "./routes/suppliers.routes.js";
import { pnlRoutes } from "./routes/pnl.routes.js";
import { campaignRoutes } from "./routes/campaigns.routes.js";
import { publicRoutes } from "./routes/public.routes.js";

const app = express();
const server = createServer(app);

// ─── Security & infra middleware ───
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: env.CORS_ORIGINS === "*" ? true : (origin, cb) => {
      if (!origin) return cb(null, true); // mobile apps, curl
      const allowed = env.CORS_ORIGINS.split(",").map(s => s.trim());
      if (allowed.includes(origin) || allowed.some(a => a.endsWith("*") && origin.startsWith(a.slice(0, -1)))) {
        return cb(null, true);
      }
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

// Skip rate limit on health checks (Render pings these constantly)
app.use((req, res, next) => {
  if (req.path.startsWith("/health")) return next();
  return rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
  })(req, res, next);
});

// ─── Root: API info ───
app.get("/", (_req, res) => {
  res.json({
    name: "MesaSmart API",
    version: "0.1.0",
    docs: "https://github.com/nelson2206/mesasmart",
    health: "/health",
    api: "/api"
  });
});

// ─── Health ───
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/health/db", async (_req, res, next) => {
  try {
    const { prisma } = await import("./prisma.js");
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ─── Routes ───
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", modRoutes); // modifications: /api/modifications/* + /api/orders/:id/items/:id/modifications
app.use("/api/calls", callRoutes);
app.use("/api", paymentRoutes); // /api/orders/:id/payment + /api/comprobantes
app.use("/api/reports", reportRoutes);
app.use("/api/ai", aiRoutes);

// ERP module
app.use("/api/ingredients", ingredientRoutes);
app.use("/api", recipeRoutes); // /api/menu-items/:id/recipe + /api/coverage
app.use("/api/inventory", inventoryRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/pnl", pnlRoutes);
app.use("/api/campaigns", campaignRoutes);

// Public routes (no auth, used by cliente.html with qrToken)
app.use("/api/public", publicRoutes);

// ─── Error handlers (must be last) ───
app.use(notFound);
app.use(errorHandler);

// ─── Sockets ───
initSockets(server);

// ─── Background priority recompute (every 30s) ───
import("./services/priority.service.js").then(({ refreshOrderPriority }) => {
  setInterval(async () => {
    try {
      const { prisma } = await import("./prisma.js");
      const open = await prisma.order.findMany({
        where: { status: { in: ["OPEN", "KITCHEN"] } },
        select: { id: true }
      });
      for (const o of open) await refreshOrderPriority(o.id);
    } catch (err) {
      logger.warn({ err }, "priority recompute failed");
    }
  }, 30_000);
});

server.listen(env.PORT, () => {
  logger.info(`🚀 MesaSmart backend listening on http://localhost:${env.PORT}`);
  logger.info(`   Env: ${env.NODE_ENV}`);
  logger.info(`   AI:  ${env.AI_FEATURES_ENABLED && env.ANTHROPIC_API_KEY ? "enabled" : "disabled"}`);
  logger.info(`   OSE: ${env.MOCK_OSE ? "MOCK" : "live"}`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
