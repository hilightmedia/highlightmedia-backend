import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createAdminUser, loginAdminUser, refreshToken, resendOtp, sendOtp, setNewPassword, verifyOtp } from "../controllers/auth";
import { sendOtpSchema, resendOtpSchema, verifyOtpSchema, setNewPasswordSchema } from "../schemas/auth";
import { RateLimiterMemory } from "rate-limiter-flexible";

const sendOtpLimiter = new RateLimiterMemory({
  keyPrefix: "send_otp",
  points: 3,
  duration: 15 * 60,
});

const resendOtpLimiter = new RateLimiterMemory({
  keyPrefix: "resend_otp",
  points: 3,
  duration: 15 * 60,
});

const verifyOtpLimiter = new RateLimiterMemory({
  keyPrefix: "verify_otp",
  points: 5,
  duration: 10 * 60,
});

const setPasswordLimiter = new RateLimiterMemory({
  keyPrefix: "set_password",
  points: 3,
  duration: 15 * 60,
});

async function consumeLimiter(
  req: FastifyRequest,
  reply: FastifyReply,
  limiter: RateLimiterMemory,
  prefix: string,
) {
  try {
    const email = (req.body as any)?.email || "anonymous";
    const xff = ((req.headers["x-forwarded-for"] as string) || "")
      .split(",")[0]
      ?.trim();
    const clientIP =
      xff ||
      (req as any).ip ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    await limiter.consume(`${prefix}:${email}:${clientIP}`);
  } catch {
    return reply.status(429).send({
      message: "Too many requests. Please try again later.",
    });
  }
}

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/create-admin-user",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "name", "password"],
          properties: {
            email: { type: "string", format: "email" },
            name: { type: "string", minLength: 3, maxLength: 50 },
            password: { type: "string", minLength: 8, maxLength: 16 },
          },
        },
      },
    },
    createAdminUser
  );

  app.post("/login", {
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8, maxLength: 16 },
        },
      },
    }
  }, loginAdminUser);

  app.post("/refresh-token", refreshToken);
  app.post(
    "/send-otp",
    {
      ...sendOtpSchema,
      preHandler: async (req, reply) => {
        return consumeLimiter(req, reply, sendOtpLimiter, "send");
      },
    },
    sendOtp,
  );

  app.post(
    "/resend-otp",
    {
      ...resendOtpSchema,
      preHandler: async (req, reply) => {
        return consumeLimiter(req, reply, resendOtpLimiter, "resend");
      },
    },
    resendOtp,
  );

  app.post(
    "/verify-otp",
    {
      ...verifyOtpSchema,
      preHandler: async (req, reply) => {
        return consumeLimiter(req, reply, verifyOtpLimiter, "verify");
      },
    },
    verifyOtp,
  );

  app.post(
    "/set-new-password",
    {
      ...setNewPasswordSchema,
      preHandler: async (req, reply) => {
        return consumeLimiter(req, reply, setPasswordLimiter, "set-password");
      },
    },
    setNewPassword,
  );
}
