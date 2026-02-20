import { RouteShorthandOptions } from "fastify";
import { authGuard } from "../services/authGuard";

export const bulkEditValiditySchema: RouteShorthandOptions = {
  preHandler: [authGuard],
  schema: {
    tags: ["Media"],
    body: {
      type: "object",
      additionalProperties: false,
      required: ["folderIds"],
      properties: {
        folderIds: {
          type: "array",
          minItems: 1,
          items: { anyOf: [{ type: "number" }, { type: "string" }] },
        },
        validityStart: { anyOf: [{ type: "string" }, { type: "null" }] },
        validityEnd: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: {
          message: { type: "string" },
        },
      },
      400: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: {
          message: { type: "string" },
        },
      },
      404: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: {
          message: { type: "string" },
        },
      },
    },
  },
};

export const bulkAddFilesToMultiplePlaylistsSchema = {
  preHandler: [authGuard],
  schema: {
    tags: ["Media"],
    body: {
      type: "object",
      additionalProperties: false,
      required: ["fileIds", "playlistIds"],
      properties: {
        fileIds: {
          type: "array",
          minItems: 1,
          maxItems: 2000,
          items: { type: "number" },
        },
        playlistIds: {
          type: "array",
          minItems: 1,
          maxItems: 200,
          items: { type: "number" },
        },
        duration: { type: "number", minimum: 1, maximum: 86400 },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["success", "inserted", "skipped"],
        properties: {
          success: { type: "boolean" },
          inserted: { type: "number" },
          skipped: { type: "number" },
        },
      },
    },
  },
};

export const getAlertsSchema = {
  schema: {
    tags: ["Media"],
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
        alerts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: {
                type: "string",
                enum: ["VALIDITY_EXPIRING", "VALIDITY_COMPLETED"],
              },
              folderId: { type: "integer" },
              folderName: { type: "string" },
              at: { type: "string" },
              message: { type: "string" },
              daysLeft: { anyOf: [{ type: "integer" }, { type: "null" }] },
            },
            required: [
              "id",
              "type",
              "folderId",
              "folderName",
              "at",
              "message",
              "daysLeft",
            ],
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
      required: ["alerts", "pagination"],
    },
  },
} as const;