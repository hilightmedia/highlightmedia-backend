import { FastifyInstance } from "fastify";

import {
  analyticsSummarySchema,
  topClientsSchema,
  topPlayersSchema,
  recentPlayerSessionsSchema,
  folderLogsSchema,
  fileLogsSchema,
  playlistLogsSchema,
  folderPlayerStatsSchema,
  playerSessionsSchema,
  getPlayerLogsSchema,
  getPlayerSessionsSchema,
} from "../schemas/analytics";

import {
  getAnalyticsSummary,
  getTopClients,
  getTopPlayers,
  getRecentPlayerSessions,
  getFolderLogs,
  getFileLogs,
  getPlaylistLogs,
  getFolderPlayerStats,
  getPlayerLogs,
  getPlayerSessions,
} from "../controllers/analytics";

type FolderPlayerStatsRoute = {
  Params: { folderId: number };
  Querystring: {
    startDate?: string;
    endDate?: string;
    offset?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };
};

type PlayerSessionsRoute = {
  Params: { playerId: number };
  Querystring: {
    startDate?: string;
    endDate?: string;
  };
};

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get("/summary", analyticsSummarySchema, getAnalyticsSummary);

  app.get("/top-clients", topClientsSchema, getTopClients);

  app.get("/top-players", topPlayersSchema, getTopPlayers);

  app.get(
    "/recent-sessions",
    recentPlayerSessionsSchema,
    getRecentPlayerSessions,
  );

  app.get("/folder-logs", folderLogsSchema, getFolderLogs);

  app.get("/file-logs", fileLogsSchema, getFileLogs);

  app.get("/playlist-file-logs", fileLogsSchema, getFileLogs);

  app.get("/playlist-logs", playlistLogsSchema, getPlaylistLogs);

  app.get<FolderPlayerStatsRoute>(
    "/folders/:folderId/player-stats",
    folderPlayerStatsSchema,
    getFolderPlayerStats,
  );

  app.get("/player-logs", getPlayerLogsSchema, getPlayerLogs);

  app.get<PlayerSessionsRoute>(
    "/player-logs/:playerId",
    getPlayerSessionsSchema,
    getPlayerSessions,
  );
}
