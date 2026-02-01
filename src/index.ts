import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import { RateLimiterMemory } from "rate-limiter-flexible";

import { env } from "./config/env.js";
import { CONSTANTS } from "./config/constants.js";
import { AppError, errorCodes, STATUS_BY_CODE } from "./utils/errors.js";

import { healthRoutes } from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import mediaRoutes from "./routes/media.js";
import playlistRoutes from "./routes/playlist.js";
import playerRoutes from "./routes/player.js";
import trashRoutes from "./routes/trash.js";
import tvAppRoutes from "./routes/tvapp.js";

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development" && {
      transport: { target: "pino-pretty", options: { colorize: true } },
    }),
  },
  trustProxy: true,
});

const rateLimiter = new RateLimiterMemory({
  keyPrefix: "rate_limit",
  points: CONSTANTS.RATE_LIMIT_POINTS,
  duration: CONSTANTS.RATE_LIMIT_DURATION,
});

await fastify.register(helmet);
await fastify.register(cors);

await fastify.register(multipart, {
  limits: {
    files: 1,
    fileSize: Number(env.MAX_FILE_MB || 100) * 1024 * 1024,
  },
});

await fastify.addContentTypeParser(
  "application/pdf",
  { parseAs: "buffer" },
  (req, body, done) => done(null, body),
);

await fastify.register(swagger, {
  openapi: {
    info: {
      title: "API",
      description:  "API Documentation",
      version: "1.0.0",
    },
    servers: [{ url: "https://api.hilightmedia.in" }, { url: "http://localhost:8000" }],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Media" },
      { name: "Playlist" },
      { name: "Players" },
      { name: "Trash" },
      { name: "TvApp" },
    ],
  },
});

await fastify.register(swaggerUI, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "full",
    deepLinking: false,
  },
  staticCSP: true,
});

fastify.addHook("preHandler", async (request, reply) => {
  try {
    const url = request.url || "";
    if (
      request.method === "OPTIONS" ||
      url.startsWith("/documentation") ||
      url.startsWith("/favicon") ||
      url.startsWith("/assets") ||
      url === "/openapi.json" ||
      url === "/documentation/json" ||
      url === "/documentation/yaml"
    ) {
      return;
    }

    const xff = ((request.headers["x-forwarded-for"] as string) || "")
      .split(",")[0]
      ?.trim();

    const clientIP =
      xff ||
      (request as any).ip ||
      request.socket?.remoteAddress ||
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

fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    const status = error.statusCode || STATUS_BY_CODE[error.code] || 400;
    reply.status(status).send({
      error: { code: error.code, message: error.message },
    });
    return;
  }

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

  fastify.log.error(error);
  reply.status(500).send({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
});

await fastify.register(healthRoutes, { prefix: "/api" });
await fastify.register(authRoutes, { prefix: "/api/auth" });
await fastify.register(mediaRoutes, { prefix: "/api/media" });
await fastify.register(playlistRoutes, { prefix: "/api/playlist" });
await fastify.register(playerRoutes, { prefix: "/api/players" });
await fastify.register(trashRoutes, { prefix: "/api/trash" });
await fastify.register(tvAppRoutes, { prefix: "/api/tv-app" });

fastify.get("/openapi.json", async (_req, reply) => {
  const doc = fastify.swagger();
  reply.send(doc);
});

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
