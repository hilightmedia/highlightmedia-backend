// routes/playlist.ts
import { FastifyInstance } from "fastify";
import { authGuard } from "../services/authGuard";
import {
  addSubPlaylist,
  addToPlaylist,
  bulkAddFilesToPlaylist,
  bulkAddSubPlaylistsToPlaylist,
  createPlaylist,
  deletePlaylist,
  deletePlaylistFile,
  getPlayList,
  getPlaylistById,
  getPlaylistOnly,
  movePlaylistFile,
} from "../controllers/playlist";

export default async function playlistRoutes(app: FastifyInstance) {
  // Get all playlists
  app.get("/", { preHandler: [authGuard] }, getPlayList);
  app.get("/list", { preHandler: [authGuard] }, getPlaylistOnly);

  // Create playlist
  app.post(
    "/create",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", minLength: 3, maxLength: 50 },
            duration: { type: "number", minimum: 1, maximum: 300 },
          },
        },
      },
      preHandler: [authGuard],
    },
    createPlaylist
  );

  // Add file to playlist
  app.post(
    "/add-file",
    {
      schema: {
        body: {
          type: "object",
          required: ["playlistId", "fileId", "duration"],
          properties: {
            playlistId: { type: "number" },
            fileId: { type: "number" },
            duration: { type: "number", minimum: 1, maximum: 86400 },
          },
        },
      },
      preHandler: [authGuard],
    },
    addToPlaylist
  );

  // Add sub-playlist to playlist
  app.post(
    "/add-sub-playlist",
    {
      schema: {
        body: {
          type: "object",
          required: ["playlistId", "subPlaylistId"],
          properties: {
            playlistId: { type: "number" },
            subPlaylistId: { type: "number" },
          },
        },
      },
      preHandler: [authGuard],
    },
    addSubPlaylist
  );

  // Move playlist item (file/sub-playlist) by playOrder
  app.post(
    "/move-item",
    {
      schema: {
        body: {
          type: "object",
          required: ["playlistFileId", "playOrder"],
          properties: {
            playlistFileId: { type: "number" },
            playOrder: { type: "number" },
          },
        },
      },
      preHandler: [authGuard],
    },
    movePlaylistFile
  );

  app.get("/:playlistId", { preHandler: [authGuard] }, getPlaylistById);
  app.delete(
    "/playlistFile/:playlistFileId",
    {
      schema: {
        params: {
          type: "object",
          required: ["playlistFileId"],
          properties: {
            playlistFileId: { type: "number" },
          },
        },
      },
      preHandler: [authGuard],
    },
    deletePlaylistFile
  );
  app.delete(
    "/:playlistId",
    {
      schema: {
        params: {
          type: "object",
          required: ["playlistId"],
          properties: {
            playlistId: { type: "number" },
          },
        },
      },
      preHandler: [authGuard],
    },
    deletePlaylist
  );
  app.post(
    "/:playlistId/bulk-add-files",
    {
      schema: {
        body: {
          type: "object",
          required: ["playlistId", "items"],
          properties: {
            playlistId: { type: "number" },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  fileId: { type: "number" },
                  duration: { type: "number", minimum: 1, maximum: 86400 },
                },
              },
            },
          },
        },
      },
      preHandler: [authGuard],
    },
    bulkAddFilesToPlaylist
  );

  app.post(
    "/:playlistId/bulk-add-sub-playlists",
    {
      schema: {
        body: {
          type: "object",
          required: ["playlistId", "items"],
          properties: {
            playlistId: { type: "number" },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  subPlaylistId: { type: "number" },
                  duration: { type: "number", minimum: 1 },
                },
              },
            },
          },
        },
      },
      preHandler: [authGuard],
    },
    bulkAddSubPlaylistsToPlaylist
  );
}
