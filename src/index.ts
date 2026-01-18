import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { env } from "./config/env.js";
import { CONSTANTS } from "./config/constants.js";
import { AppError, errorCodes, STATUS_BY_CODE } from "./utils/errors.js";
import { healthRoutes } from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import path from "path";
import { fileURLToPath } from "url";

import multipart from "@fastify/multipart";
import mediaRoutes from "./routes/media.js";
import playlistRoutes from "./routes/playlist.js";
import playerRoutes from "./routes/player.js";
import trashRoutes from "./routes/trash.js";


// ──────────────────────────────────────────────
// Fastify instance

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development" && {
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    }),
  },
  // FIX: ensure correct client IP when behind proxies / localhost tools
  trustProxy: true,
});

// ──────────────────────────────────────────────
// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyPrefix: "rate_limit",
  points: CONSTANTS.RATE_LIMIT_POINTS,
  duration: CONSTANTS.RATE_LIMIT_DURATION,
});

// ──────────────────────────────────────────────
// Plugins
await fastify.register(helmet);
await fastify.register(cors);

// multipart for file uploads
fastify.register(multipart, {
  limits: {
    files: 10, // max 10 files
    fileSize: (Number(env.MAX_FILE_MB || 100) * 1024 * 1024),
  },
});
await fastify.addContentTypeParser(
  "application/pdf",
  { parseAs: "buffer" },
  (req, body, done) => done(null, body),
);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await fastify.register(swagger, {
  mode: "static",
  specification: {
    path: path.join(__dirname, "../openapi.json"), // adjust path relative to this file
    baseDir: process.cwd(), // so $ref work correctly
  },
});

await fastify.register(swaggerUI, {
  routePrefix: "/documentation",
  uiConfig: {
    docExpansion: "full",
    deepLinking: false,
  },
  staticCSP: true,
});


// Rate limiting middleware for All routes
fastify.addHook("preHandler", async (request, reply) => {
  try {
    // FIX: Skip preflight requests (CORS) and docs/static assets that auto-load
    const url = request.url || "";
    if (
      request.method === "OPTIONS" ||
      url.startsWith("/documentation") ||
      url.startsWith("/favicon") ||
      url === "/openapi.json" ||
      url.startsWith("/assets") // swagger-ui asset path (defensive)
    ) {
      return;
    }

    // FIX: Robust client IP resolution (works with trustProxy)
    const xff = ((request.headers["x-forwarded-for"] as string) || "")
      .split(",")[0]
      ?.trim();
    const clientIP =
      xff ||
      (request as any).ip ||
      (request.socket && request.socket.remoteAddress) ||
      "127.0.0.1";

    await rateLimiter.consume(clientIP);
  } catch {
    reply.status(429).send({
      error: {
        code: errorCodes.RATE_LIMIT_EXCEEDED,
        message: "Too many requests",
      },
    });
  }
});

// ──────────────────────────────────────────────
// Error handler
fastify.setErrorHandler((error, request, reply) => {
  // Our domain errors
  if (error instanceof AppError) {
    const status = error.statusCode || STATUS_BY_CODE[error.code] || 400;

    reply.status(status).send({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  // AJV validation errors (Fastify v4)
  if ((error as any).validation) {
    reply.status(400).send({
      error: {
        code: errorCodes.VALIDATION_ERROR,
        message: "Invalid request data",
        details: (error as any).validation,
      },
    });
    return;
  }

  // Fallback
  fastify.log.error(error);
  reply.status(500).send({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
});

// ──────────────────────────────────────────────
// Routes
await fastify.register(healthRoutes, { prefix: "/api" });
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(mediaRoutes, { prefix: "/api/media" });
await fastify.register(playlistRoutes, { prefix: "/api/playlist" });
await fastify.register(playerRoutes, { prefix: "/api/players" });
await fastify.register(trashRoutes, { prefix: "/api/trash" });


// ──────────────────────────────────────────────
// Start server (skipped during tests)
const start = async () => {
  try {
    await fastify.listen({ port: env.PORT, host: "127.0.0.1" });
    fastify.log.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

if (env.NODE_ENV !== "test") {
  start();
}

export { fastify };
