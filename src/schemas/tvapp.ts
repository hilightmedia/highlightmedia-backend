import { RouteShorthandOptions } from "fastify";

export const linkPlayerSchema: RouteShorthandOptions = {
  schema: {
    tags: ["TvApp"],
    body: {
      type: "object",
      required: ["deviceName", "deviceKey"],
      properties: {
        deviceName: { type: "string", minLength: 1 },
        deviceKey: { type: "string", minLength: 1, maxLength: 16 },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: "object",
        required: ["message", "player"],
        properties: {
          message: { type: "string" },
          player: {
            type: "object",
            required: ["id", "deviceCode", "linked"],
            properties: {
              id: { type: "number" },
              deviceCode: { type: "string" },
              playlistId: { anyOf: [{ type: "number" }, { type: "null" }] },
              location: { anyOf: [{ type: "string" }, { type: "null" }] },
              linked: { type: "boolean" },
            },
          },
        },
      },
      404: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};

export const getPlaylistSchema: RouteShorthandOptions = {
  schema: {
    tags: ["TvApp"],
    params: {
      type: "object",
      required: ["deviceCode"],
      properties: {
        deviceCode: { type: "string", minLength: 1, maxLength: 16 },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: "object",
        required: ["playlist"],
        additionalProperties: false,
        properties: {
          playlist: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                required: ["id", "name", "defaultDuration", "playlistFiles"],
                additionalProperties: false,
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                  defaultDuration: { type: "number" },
                  playlistFiles: {
                    type: "array",
                    items: {
                      type: "object",
                      required: [
                        "id",
                        "playOrder",
                        "duration",
                        "isSubPlaylist",
                        "fileId",
                        "subPlaylistId",
                        "file",
                      ],
                      additionalProperties: false,
                      properties: {
                        id: { type: "number" },
                        playOrder: { type: "number" },
                        duration: { type: "number" },
                        isSubPlaylist: { type: "boolean" },
                        fileId: { anyOf: [{ type: "number" }, { type: "null" }] },
                        subPlaylistId: { anyOf: [{ type: "number" }, { type: "null" }] },
                        file: {
                          anyOf: [
                            { type: "null" },
                            {
                              type: "object",
                              required: [
                                "id",
                                "name",
                                "fileType",
                                "fileKey",
                                "fileSize",
                                "duration",
                                "verified",
                                "folderId",
                                "createdAt",
                                "updatedAt",
                              ],
                              additionalProperties: false,
                              properties: {
                                id: { type: "number" },
                                name: { type: "string" },
                                fileType: { type: "string" },
                                fileKey: { type: "string" },
                                fileSize: { type: "string" },
                                duration: { type: "string" },
                                verified: { type: "boolean" },
                                folderId: { type: "number" },
                                createdAt: { anyOf: [{ type: "string" }, { type: "object" }] },
                                updatedAt: { anyOf: [{ type: "string" }, { type: "object" }] },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
      404: {
        type: "object",
        required: ["message"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
        },
      },
    },
  },
};

export const createPlayLogSchema: RouteShorthandOptions = {
  schema: {
    tags: ["TvApp"],
    params: {
      type: "object",
      required: ["deviceCode"],
      properties: {
        deviceCode: { type: "string", minLength: 1, maxLength: 16 },
      },
      additionalProperties: false,
    },
    body: {
      type: "object",
      required: ["fileId"],
      properties: {
        playlistFileId: { anyOf: [{ type: "number" }, { type: "null" }] },
        fileId: { type: "number" },
        playlistId: { anyOf: [{ type: "number" }, { type: "null" }] },
        subPlaylistId: { anyOf: [{ type: "number" }, { type: "null" }] },
        isSubPlaylist: { type: "boolean" },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: "object",
        required: ["message", "playLogId"],
        properties: {
          message: { type: "string" },
          playLogId: { type: "number" },
        },
      },
      404: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};

export const startPlayerSessionSchema: RouteShorthandOptions = {
  schema: {
    tags: ["TvApp"],
    params: {
      type: "object",
      required: ["deviceCode"],
      properties: {
        deviceCode: { type: "string", minLength: 1, maxLength: 16 },
      },
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: {
        forceNew: { type: "boolean" },
      },
      // additionalProperties: false,
    },
    response: {
      200: {
        type: "object",
        required: ["message", "session"],
        properties: {
          message: { type: "string" },
          session: {
            type: "object",
            required: ["id", "playerId", "startedAt", "lastActiveAt", "isActive"],
            properties: {
              id: { type: "number" },
              playerId: { type: "number" },
              startedAt: { type: "string" },
              endedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
              lastActiveAt: { type: "string" },
              isActive: { type: "boolean" },
            },
            additionalProperties: true,
          },
        },
      },
      404: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};

export const endPlayerSessionSchema: RouteShorthandOptions = {
  schema: {
    tags: ["TvApp"],
    params: {
      type: "object",
      required: ["deviceCode"],
      properties: {
        deviceCode: { type: "string", minLength: 1, maxLength: 16 },
      },
      additionalProperties: false,
    },
    body: {
      type: "object",
      properties: {
        endAll: { type: "boolean" },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: "object",
        required: ["message", "endedCount"],
        properties: {
          message: { type: "string" },
          endedCount: { type: "number" },
        },
      },
      404: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};
