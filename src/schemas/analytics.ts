import { RouteShorthandOptions } from "fastify";

const dateQuery = {
  type: "object",
  properties: {
    date: { type: "string", minLength: 10, maxLength: 10 },
  },
  additionalProperties: true,
};

export const analyticsSummarySchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: dateQuery,
    response: {
      200: {
        type: "object",
        required: ["message", "data"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          data: {
            type: "object",
            required: ["totalFolders", "players", "online", "offline"],
            additionalProperties: false,
            properties: {
              totalFolders: { type: "number" },
              players: { type: "number" },
              online: { type: "number" },
              offline: { type: "number" },
            },
          },
        },
      },
    },
  },
};

export const analyticsTopClientsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: dateQuery,
    response: {
      200: {
        type: "object",
        required: ["message", "items"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["folderId", "folderName", "adsPlayed"],
              additionalProperties: false,
              properties: {
                folderId: { type: "number" },
                folderName: { type: "string" },
                adsPlayed: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
};

export const analyticsTopPlayersSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: dateQuery,
    response: {
      200: {
        type: "object",
        required: ["message", "items"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["playerId", "playerName", "adsPlayed"],
              additionalProperties: false,
              properties: {
                playerId: { type: "number" },
                playerName: { type: "string" },
                adsPlayed: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
};

export const analyticsRecentSessionsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      properties: {
        date: { type: "string", minLength: 10, maxLength: 10 },
        sortBy: { type: "string", enum: ["name", "status", "lastActive"] },
        sortOrder: { type: "string", enum: ["asc", "desc"] },
      },
      additionalProperties: true,
    },
    response: {
      200: {
        type: "object",
        required: ["message", "items"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: [
                "playerId",
                "name",
                "sessionStart",
                "sessionEnd",
                "status",
                "lastActive",
                "sessionDurationSec",
              ],
              additionalProperties: false,
              properties: {
                playerId: { type: "number" },
                name: { type: "string" },
                sessionStart: { anyOf: [{ type: "string" }, { type: "null" }] },
                sessionEnd: { anyOf: [{ type: "string" }, { type: "null" }] },
                status: { type: "string", enum: ["Online", "Offline"] },
                lastActive: { anyOf: [{ type: "string" }, { type: "null" }] },
                sessionDurationSec: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
};
