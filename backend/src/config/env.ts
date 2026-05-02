import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  API_BASE_URL: z.string().default("http://localhost:3001"),
  DATABASE_URL: z.string(),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  CORS_ORIGINS: z.string().default("*"),

  MOCK_OSE: z.coerce.boolean().default(true),
  MOCK_PAYMENTS: z.coerce.boolean().default(true),
  MOCK_EMAIL: z.coerce.boolean().default(true),
  MOCK_STORAGE: z.coerce.boolean().default(true),

  NUBEFACT_API_URL: z.string().optional(),
  NUBEFACT_TOKEN: z.string().optional(),
  SUNAT_BOLETA_SERIE: z.string().default("B001"),
  SUNAT_FACTURA_SERIE: z.string().default("F001"),

  CULQI_PUBLIC_KEY: z.string().optional(),
  CULQI_PRIVATE_KEY: z.string().optional(),
  YAPE_API_TOKEN: z.string().optional(),
  PLIN_API_TOKEN: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("hola@mesasmart.pe"),

  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default("mesasmart"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SENTRY_DSN: z.string().optional(),

  // ─── AI (Anthropic Claude) ───
  // Si está vacío, los endpoints de AI usan fallback determinístico.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  AI_FEATURES_ENABLED: z.coerce.boolean().default(false)
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
