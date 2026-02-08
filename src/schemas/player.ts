import { authGuard } from "../services/authGuard";

export const getActivitySchema = {
  schema: {
    tags: ["Player"],
  },
  preHandler: [authGuard],
  querystring: {
    type: "object",
    properties: {
      offset: { anyOf: [{ type: "integer", minimum: 0 }, { type: "string" }] },
      limit: {
        anyOf: [
          { type: "integer", minimum: 1, maximum: 100 },
          { type: "string" },
        ],
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: "object",
      properties: {
        activity: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: ["ONLINE", "OFFLINE"] },
              playerId: { type: "integer" },
              playerName: { type: "string" },
              at: { type: "string" },
              message: { type: "string" },
            },
            required: ["id", "type", "playerId", "playerName", "at", "message"],
          },
        },
        pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
            hasMore: { type: "boolean" },
          },
          required: ["total", "limit", "offset", "hasMore"],
        },
      },
      required: ["activity", "pagination"],
    },
  },
};
