/**
 * Socket.io · Real-time layer
 * ──────────────────────────────
 * Rooms:
 *   restaurant:{id}                       — broadcast general
 *   restaurant:{id}:role:{ROLE}           — por rol (KITCHEN, WAITER, ADMIN)
 *   restaurant:{id}:role:WAITER:{userId}  — mozo individual
 *   restaurant:{id}:order:{orderId}       — siguiendo una orden
 *   restaurant:{id}:table:{tableNumber}   — cliente en su mesa
 */

import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { JwtPayload } from "../middleware/auth.js";

let io: Server;

export function initSockets(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: env.CORS_ORIGINS.split(","), credentials: true },
    pingTimeout: 60000
  });

  // Auth middleware — accepts token via query or auth header
  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);

    // Cliente "público" (mesa) entra con qrToken — sin JWT, restringido
    const qrToken = socket.handshake.query?.qrToken as string | undefined;
    if (qrToken) {
      // Anonymous client identified by qrToken — limited permissions
      (socket.data as any).client = { type: "GUEST", qrToken };
      return next();
    }

    if (!token) return next(new Error("missing_token"));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      (socket.data as any).user = payload;
      next();
    } catch {
      next(new Error("invalid_token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket.data as any).user as JwtPayload | undefined;
    const guest = (socket.data as any).client;

    if (user) {
      logger.info({ userId: user.userId, role: user.role }, "WS user connected");
      socket.join(`restaurant:${user.restaurantId}`);
      socket.join(`restaurant:${user.restaurantId}:role:${user.role}`);
      if (user.role === "WAITER") {
        socket.join(`restaurant:${user.restaurantId}:role:WAITER:${user.userId}`);
      }
    } else if (guest) {
      logger.info({ qrToken: guest.qrToken }, "WS guest connected");
      // Guest joins their table room only after subscribe:table
    }

    // ──────── Subscription handlers ────────
    socket.on("subscribe:order", (orderId: string) => {
      if (!user) return;
      socket.join(`restaurant:${user.restaurantId}:order:${orderId}`);
    });

    socket.on("unsubscribe:order", (orderId: string) => {
      if (!user) return;
      socket.leave(`restaurant:${user.restaurantId}:order:${orderId}`);
    });

    socket.on("subscribe:table", (tableNumber: number) => {
      // For now, just join — production should validate qrToken matches the table
      const restId = user?.restaurantId ?? "guest";
      socket.join(`restaurant:${restId}:table:${tableNumber}`);
    });

    socket.on("disconnect", () => {
      logger.debug({ id: socket.id }, "WS disconnected");
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

// ──────── Emit helpers ────────
export const sockets = {
  toRestaurant(restaurantId: string, event: string, payload: unknown) {
    getIO().to(`restaurant:${restaurantId}`).emit(event, payload);
  },
  toRole(restaurantId: string, role: string, event: string, payload: unknown) {
    getIO().to(`restaurant:${restaurantId}:role:${role}`).emit(event, payload);
  },
  toWaiter(restaurantId: string, waiterId: string, event: string, payload: unknown) {
    getIO().to(`restaurant:${restaurantId}:role:WAITER:${waiterId}`).emit(event, payload);
  },
  toOrder(restaurantId: string, orderId: string, event: string, payload: unknown) {
    getIO().to(`restaurant:${restaurantId}:order:${orderId}`).emit(event, payload);
  },
  toTable(restaurantId: string, tableNumber: number, event: string, payload: unknown) {
    getIO().to(`restaurant:${restaurantId}:table:${tableNumber}`).emit(event, payload);
  }
};
