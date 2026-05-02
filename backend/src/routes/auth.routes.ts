import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { signToken, authRequired } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRoutes.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) throw new HttpError(401, "invalid_credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, "invalid_credentials");
    const token = signToken({
      userId: user.id,
      restaurantId: user.restaurantId,
      role: user.role as any
    });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarColor: user.avatarColor,
        restaurantId: user.restaurantId
      }
    });
  })
);

authRoutes.get(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { restaurant: { select: { id: true, name: true, ruc: true, address: true } } }
    });
    if (!user) throw new HttpError(404, "user_not_found");
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarColor: user.avatarColor,
      restaurant: user.restaurant
    });
  })
);
