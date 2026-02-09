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

export const getFolderLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        search: { type: "string" },
        sortBy: {
          type: "string",
          enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"],
          default: "lastPlayed",
        },
        sortOrder: {
          type: "string",
          enum: ["asc", "desc"],
          default: "desc",
        },
        offset: { anyOf: [{ type: "string" }, { type: "number" }], default: 0 },
        limit: { anyOf: [{ type: "string" }, { type: "number" }], default: 10 },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "items", "pagination", "meta"],
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "folderId",
                "folderName",
                "thumbnail",
                "lastPlayedAt",
                "totalRunTimeSec",
                "devices",
                "plays",
              ],
              properties: {
                folderId: { type: "number" },
                folderName: { type: "string" },
                thumbnail: { type: "string" },
                lastPlayedAt: {
                  anyOf: [{ type: "string" }, { type: "object" }, { type: "null" }],
                },
                totalRunTimeSec: { type: "number" },
                devices: { type: "number" },
                plays: { type: "number" },
              },
            },
          },
          pagination: {
            type: "object",
            additionalProperties: false,
            required: ["total", "offset", "limit", "hasMore"],
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: {
            type: "object",
            additionalProperties: false,
            required: ["sortBy", "sortOrder", "search", "date"],
            properties: {
              sortBy: {
                type: "string",
                enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"],
              },
              sortOrder: { type: "string", enum: ["asc", "desc"] },
              search: { anyOf: [{ type: "string" }, { type: "null" }] },
              date: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["start", "end"],
                    properties: {
                      start: { type: "string" },
                      end: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      400: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      500: {
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      },
    },
  },
};

export const getFileLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        search: { type: "string" },
        sortBy: {
          type: "string",
          enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"],
          default: "lastPlayed",
        },
        sortOrder: {
          type: "string",
          enum: ["asc", "desc"],
          default: "desc",
        },
        offset: { anyOf: [{ type: "string" }, { type: "number" }], default: 0 },
        limit: { anyOf: [{ type: "string" }, { type: "number" }], default: 10 },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "items", "pagination", "meta"],
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "fileId",
                "fileName",
                "fileType",
                "folderId",
                "folderName",
                "signedUrl",
                "lastPlayedAt",
                "totalRunTimeSec",
                "devices",
                "plays",
              ],
              properties: {
                fileId: { type: "number" },
                fileName: { type: "string" },
                fileType: { type: "string" },
                folderId: { type: "number" },
                folderName: { type: "string" },
                signedUrl: { type: "string" },
                lastPlayedAt: { anyOf: [{ type: "string" }, { type: "object" }, { type: "null" }] },
                totalRunTimeSec: { type: "number" },
                devices: { type: "number" },
                plays: { type: "number" },
              },
            },
          },
          pagination: {
            type: "object",
            additionalProperties: false,
            required: ["total", "offset", "limit", "hasMore"],
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: {
            type: "object",
            additionalProperties: false,
            required: ["sortBy", "sortOrder", "search", "date"],
            properties: {
              sortBy: { type: "string", enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"] },
              sortOrder: { type: "string", enum: ["asc", "desc"] },
              search: { anyOf: [{ type: "string" }, { type: "null" }] },
              date: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["start", "end"],
                    properties: {
                      start: { type: "string" },
                      end: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};

export const getPlaylistFileLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        search: { type: "string" },
        playlistId: { anyOf: [{ type: "number" }, { type: "string" }] },
        sortBy: {
          type: "string",
          enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"],
          default: "lastPlayed",
        },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        offset: { anyOf: [{ type: "string" }, { type: "number" }], default: 0 },
        limit: { anyOf: [{ type: "string" }, { type: "number" }], default: 10 },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "items", "pagination", "meta"],
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "playlistFileId",
                "playlistId",
                "playlistName",
                "playOrder",
                "isSubPlaylist",
                "fileId",
                "fileName",
                "fileType",
                "signedUrl",
                "subPlaylistId",
                "subPlaylistName",
                "lastPlayedAt",
                "totalRunTimeSec",
                "devices",
                "plays",
              ],
              properties: {
                playlistFileId: { type: "number" },
                playlistId: { type: "number" },
                playlistName: { type: "string" },
                playOrder: { type: "number" },
                isSubPlaylist: { type: "boolean" },
                fileId: { anyOf: [{ type: "number" }, { type: "null" }] },
                fileName: { anyOf: [{ type: "string" }, { type: "null" }] },
                fileType: { anyOf: [{ type: "string" }, { type: "null" }] },
                signedUrl: { type: "string" },
                subPlaylistId: { anyOf: [{ type: "number" }, { type: "null" }] },
                subPlaylistName: { anyOf: [{ type: "string" }, { type: "null" }] },
                lastPlayedAt: { anyOf: [{ type: "string" }, { type: "object" }, { type: "null" }] },
                totalRunTimeSec: { type: "number" },
                devices: { type: "number" },
                plays: { type: "number" },
              },
            },
          },
          pagination: {
            type: "object",
            additionalProperties: false,
            required: ["total", "offset", "limit", "hasMore"],
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: {
            type: "object",
            additionalProperties: false,
            required: ["sortBy", "sortOrder", "search", "playlistId", "date"],
            properties: {
              sortBy: { type: "string", enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"] },
              sortOrder: { type: "string", enum: ["asc", "desc"] },
              search: { anyOf: [{ type: "string" }, { type: "null" }] },
              playlistId: { anyOf: [{ type: "number" }, { type: "null" }] },
              date: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["start", "end"],
                    properties: { start: { type: "string" }, end: { type: "string" } },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};

export const getPlaylistLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        search: { type: "string" },
        sortBy: {
          type: "string",
          enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"],
          default: "lastPlayed",
        },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        offset: { anyOf: [{ type: "string" }, { type: "number" }], default: 0 },
        limit: { anyOf: [{ type: "string" }, { type: "number" }], default: 10 },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "items", "pagination", "meta"],
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "playlistId",
                "playlistName",
                "lastPlayedAt",
                "totalRunTimeSec",
                "devices",
                "plays",
              ],
              properties: {
                playlistId: { type: "number" },
                playlistName: { type: "string" },
                lastPlayedAt: { anyOf: [{ type: "string" }, { type: "object" }, { type: "null" }] },
                totalRunTimeSec: { type: "number" },
                devices: { type: "number" },
                plays: { type: "number" },
              },
            },
          },
          pagination: {
            type: "object",
            additionalProperties: false,
            required: ["total", "offset", "limit", "hasMore"],
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: {
            type: "object",
            additionalProperties: false,
            required: ["sortBy", "sortOrder", "search", "date"],
            properties: {
              sortBy: { type: "string", enum: ["lastPlayed", "totalRunTime", "devices", "plays", "name"] },
              sortOrder: { type: "string", enum: ["asc", "desc"] },
              search: { anyOf: [{ type: "string" }, { type: "null" }] },
              date: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["start", "end"],
                    properties: { start: { type: "string" }, end: { type: "string" } },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};
