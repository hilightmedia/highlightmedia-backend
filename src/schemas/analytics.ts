import { RouteShorthandOptions } from "fastify";

const dateQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    startDate: { type: "string" },
    endDate: { type: "string" },
    date: { type: "string" },
    sortBy: { type: "string" },
    sortOrder: { type: "string", enum: ["asc", "desc"] },
    search: { type: "string" },
    offset: { type: "number" },
    limit: { type: "number" },
    playlistId: { type: "number" },
    playerId: { type: "number" },
  },
};

export const analyticsSummarySchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
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

export const topClientsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      required: ["date"],
      additionalProperties: false,
      properties: {
        date: { type: "string" },
      },
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

export const topPlayersSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      required: ["date"],
      additionalProperties: false,
      properties: {
        date: { type: "string" },
      },
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

export const recentPlayerSessionsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      required: ["date"],
      additionalProperties: false,
      properties: {
        date: { type: "string" },
        sortBy: { type: "string" },
        sortOrder: { type: "string", enum: ["asc", "desc"] },
      },
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
                status: { type: "string" },
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

export const folderLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: dateQuery,
    response: {
      200: {
        type: "object",
        required: ["message", "items", "pagination", "meta"],
        additionalProperties: false,
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
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },

                totalRunTimeSec: { type: "number" },
                devices: { type: "number" },
                plays: { type: "number" },
              },
            },
          },
          pagination: {
            type: "object",
            required: ["total", "offset", "limit", "hasMore"],
            additionalProperties: false,
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: { type: "object" },
        },
      },
    },
  },
};

export const fileLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: dateQuery,
    response: {
      200: {
        type: "object",
        required: ["message", "items", "pagination", "meta"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          items: { type: "array", items: { type: "object" } },
          pagination: {
            type: "object",
            required: ["total", "offset", "limit", "hasMore"],
            additionalProperties: false,
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: { type: "object" },
        },
      },
    },
  },
};

export const playlistFileLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: dateQuery,
    response: {
      200: {
        type: "object",
        required: ["message", "items", "pagination", "meta"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          items: { type: "array", items: { type: "object" } },
          pagination: {
            type: "object",
            required: ["total", "offset", "limit", "hasMore"],
            additionalProperties: false,
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: { type: "object" },
        },
      },
    },
  },
};

export const playlistLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: dateQuery,
    response: {
      200: {
        type: "object",
        required: ["message", "items", "pagination", "meta"],
        additionalProperties: false,
        properties: {
          message: { type: "string" },
          items: { type: "array", items: { type: "object" } },
          pagination: {
            type: "object",
            required: ["total", "offset", "limit", "hasMore"],
            additionalProperties: false,
            properties: {
              total: { type: "number" },
              offset: { type: "number" },
              limit: { type: "number" },
              hasMore: { type: "boolean" },
            },
          },
          meta: { type: "object" },
        },
      },
    },
  },
};

export const folderPlayerStatsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    params: {
      type: "object",
      required: ["folderId"],
      additionalProperties: false,
      properties: {
        folderId: { type: "number" },
      },
    },
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
        search: { type: "string" },
        sortBy: { type: "string" },
        sortOrder: { type: "string", enum: ["asc", "desc"] },
        offset: { type: "number" },
        limit: { type: "number" },
      },
    },
    response: {
      200: {
        type: "object",
        required: ["message", "items", "pagination", "meta"],
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: [
                "playerId",
                "playerName",
                "lastActive",
                "plays",
                "totalHours",
                "status",
              ],
              properties: {
                playerId: { type: "number" },
                playerName: { type: "string" },
                lastActive: { anyOf: [{ type: "string" }, { type: "null" }] },
                plays: { type: "number" },
                totalHours: { type: "number" },
                status: { type: "string" },
              },
            },
          },
          pagination: {
            type: "object",
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
            properties: {
              totalPlayers: { type: "number" },
              date: { type: "object" },
            },
          },
        },
      },
    },
  },
};


export const getPlayerLogsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "items"],
        properties: {
          message: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "id",
                "name",
                "sessionStart",
                "sessionEnd",
                "status",
                "lastActive",
                "totalRunTimeSec",
              ],
              properties: {
                id: { type: "number" },
                name: { type: "string" },
                sessionStart: {
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },
                sessionEnd: {
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },
                status: {
                  type: "string",
                  enum: ["Online", "Offline"],
                },
                lastActive: {
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },
                totalRunTimeSec: { type: "number" },
              },
            },
          },
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
      500: {
        type: "object",
        additionalProperties: false,
        properties: {
          message: { type: "string" },
        },
      },
    },
  },
};

export const getPlayerSessionsSchema: RouteShorthandOptions = {
  schema: {
    tags: ["Analytics"],
    params: {
      type: "object",
      additionalProperties: false,
      required: ["playerId"],
      properties: {
        playerId: { type: "number" },
      },
    },
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        startDate: { type: "string" },
        endDate: { type: "string" },
      },
    },
    response: {
      200: {
        type: "object",
        additionalProperties: false,
        required: ["message", "items"],
        properties: {
          message: { type: "string" },
          player:{
            type: "object",
            additionalProperties: false,
            required: ["id", "name"],
            properties: {
              id: { type: "number" },
              name: { type: "string" },
            },
          },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "sessionStart",
                "sessionEnd",
                "status",
                "lastActive",
                "totalRunTimeSec",
              ],
              properties: {
                sessionStart: {
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },
                sessionEnd: {
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },
                status: {
                  type: "string",
                  enum: ["Online", "Offline"],
                },
                lastActive: {
                  anyOf: [
                    { type: "string", format: "date-time" },
                    { type: "null" },
                  ],
                },
                totalRunTimeSec: { type: "number" },
              },
            },
          },
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

export const playerSessionsSchema: RouteShorthandOptions = {
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
          items: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
};