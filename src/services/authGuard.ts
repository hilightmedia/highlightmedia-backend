import { FastifyRequest, FastifyReply } from "fastify";
import { JwtService } from "./jwt";

export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  try {
    const hdr = req.headers.authorization;

    if (!hdr?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
    const token = hdr.slice("Bearer ".length).trim();
    console.log("token", token);
    const payload = JwtService.verifyAccess(token);
    console.log("payload", payload);
    if (payload.type !== "access") {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
    (req as any).user = payload; // attach
  } catch (e: any) {
    return reply.code(401).send({ error: e?.message ?? "UNAUTHORIZED" });
  }
}
