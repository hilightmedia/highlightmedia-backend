import { authGuard } from "../services/authGuard";

export const bulkDeletePlaylistsSchema = {
  preHandler: [authGuard],
  schema: {
    body: {
      type: "object",
      additionalProperties: false,
      required: ["playlistIds"],
      properties: {
        playlistIds: {
          type: "array",
          minItems: 1,
          maxItems: 500,
          items: { type: "number" },
        },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "deletedCount", "deletedIds"],
        properties: {
          message: { type: "string" },
          deletedCount: { type: "number" },
          deletedIds: { type: "array", items: { type: "number" } },
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
    },
  },
};

export const bulkDeletePlaylistFilesSchema = {
  preHandler: [authGuard],
  schema: {
    body: {
      type: "object",
      additionalProperties: false,
      required: ["playlistFileIds"],
      properties: {
        playlistFileIds: {
          type: "array",
          minItems: 1,
          maxItems: 500,
          items: { type: "number" },
        },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "deletedCount", "deletedIds"],
        properties: {
          message: { type: "string" },
          deletedCount: { type: "number" },
          deletedIds: { type: "array", items: { type: "number" } },
        },
      },
      400: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      404: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};

export const bulkEditPlaylistFileDurationSchema = {
  preHandler: [authGuard],
  schema: {
    body: {
      type: "object",
      additionalProperties: false,
      required: ["playlistFileIds", "duration"],
      properties: {
        playlistFileIds: {
          type: "array",
          minItems: 1,
          maxItems: 500,
          items: { type: "number" },
        },
        duration: {
          type: "number",
          minimum: 1,
          maximum: 86400,
        },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "updatedCount", "updatedIds", "duration"],
        properties: {
          message: { type: "string" },
          updatedCount: { type: "number" },
          updatedIds: { type: "array", items: { type: "number" } },
          duration: { type: "number" },
        },
      },
      400: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      404: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};

export const editPlaylistFileDurationSchema = {
  preHandler: [authGuard],
  schema: {
    params: {
      type: "object",
      additionalProperties: false,
      required: ["playlistFileId"],
      properties: {
        playlistFileId: { type: "number" },
      },
    },
    body: {
      type: "object",
      additionalProperties: false,
      required: ["duration"],
      properties: {
        duration: { type: "number", minimum: 1, maximum: 86400 },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "skipped"],
        properties: {
          message: { type: "string" },
          skipped: { type: "boolean" },
          reason: { type: "string" },
          playlistFileId: { type: "number" },
          playlistFile: {
            type: "object",
            additionalProperties: false,
            required: ["playlistFileId", "playlistId", "duration"],
            properties: {
              playlistFileId: { type: "number" },
              playlistId: { type: "number" },
              duration: { type: "number" },
            },
          },
        },
        allOf: [
          {
            if: {
              properties: { skipped: { const: true } },
              required: ["skipped"],
            },
            then: { required: ["reason", "playlistFileId"] },
          },
          {
            if: {
              properties: { skipped: { const: false } },
              required: ["skipped"],
            },
            then: { required: ["playlistFile"] },
          },
        ],
      },
      400: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      404: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};


