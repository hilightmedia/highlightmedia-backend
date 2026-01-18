/* Ensure this file is treated as a global type definition (no imports here) */
import "fastify"; // keep this so TS knows which module to augment

declare module "fastify" {
  // ---- Request-scoped stuff (e.g., req.user from your auth) ----
  interface FastifyRequest {
    user?: {
      id: number;
      name: string;
      email: string;
      type: "access" | "refresh";
      iat: number;
      exp: number;
    };
  }
}