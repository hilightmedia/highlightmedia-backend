import { FastifyInstance } from "fastify";
import {
  analyticsRecentSessionsSchema,
  analyticsSummarySchema,
  analyticsTopClientsSchema,
  analyticsTopPlayersSchema,
} from "../schemas/analytics";
import {
  getAnalyticsSummary,
  getRecentPlayerSessions,
  getTopClients,
  getTopPlayers,
} from "../controllers/analytics";

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get("/summary", analyticsSummarySchema, getAnalyticsSummary);
  app.get("/top-clients", analyticsTopClientsSchema, getTopClients);
  app.get("/top-players", analyticsTopPlayersSchema, getTopPlayers);
  app.get("/recent-sessions", analyticsRecentSessionsSchema, getRecentPlayerSessions);
}
