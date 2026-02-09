import { FastifyInstance } from "fastify";
import {
  analyticsRecentSessionsSchema,
  analyticsSummarySchema,
  analyticsTopClientsSchema,
  analyticsTopPlayersSchema,
  getFileLogsSchema,
  getFolderLogsSchema,
  getPlaylistLogsSchema,
} from "../schemas/analytics";
import {
  getFileLogs,
  getAnalyticsSummary,
  getFolderLogs,
  getRecentPlayerSessions,
  getTopClients,
  getTopPlayers,
  getPlaylistLogs,
} from "../controllers/analytics";

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get("/summary", analyticsSummarySchema, getAnalyticsSummary);
  app.get("/top-clients", analyticsTopClientsSchema, getTopClients);
  app.get("/top-players", analyticsTopPlayersSchema, getTopPlayers);
  app.get("/recent-sessions", analyticsRecentSessionsSchema, getRecentPlayerSessions);
  app.get("/folder-logs", getFolderLogsSchema, getFolderLogs);  
  app.get("/file-logs", getFileLogsSchema, getFileLogs);
  app.get("/playlist-file-logs", getFileLogsSchema, getFileLogs);
  app.get("/playlist-logs", getPlaylistLogsSchema, getPlaylistLogs);
}
