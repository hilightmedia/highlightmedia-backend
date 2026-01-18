import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().transform(Number).default("8000"),
  DATABASE_URL: z.string(),
  CORS_ORIGIN: z.string(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_PROMPTS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters long"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters long"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  OTP_TTL_SECONDS: z.string().transform(Number).default("300"),
  OTP_MAX_VERIFY_ATTEMPTS: z.string().transform(Number).default("5"),
  OTP_MAX_PER_HOUR: z.string().transform(Number).default("5"),
  BCRYPT_SALT_ROUNDS: z.string().transform(Number),
  MAX_FILE_MB: z.string().transform(Number).default("100"),
  AWS_S3_BUCKET_NAME: z.string(),
});

export const env = envSchema.parse(process.env);
