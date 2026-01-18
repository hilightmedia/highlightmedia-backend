import { FastifyInstance } from "fastify";
import { getPlayers, createPlayer, loginPlayer } from "../controllers/player";
import { authGuard } from "../services/authGuard";


export default async function playerRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authGuard] }, getPlayers);
  app.post("/", { preHandler: [authGuard] }, createPlayer);

  app.post("/login", loginPlayer);
}
