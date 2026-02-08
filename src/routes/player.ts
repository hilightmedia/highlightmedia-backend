import { FastifyInstance } from "fastify";
import { getPlayers,  deletePlayer, createPlayer, editPlayer, updatePlayerPlaylist, getActivity } from "../controllers/player";
import { authGuard } from "../services/authGuard";
import { getActivitySchema } from "../schemas/player";

export default async function playerRoutes(app: FastifyInstance) {
   app.get(
    "/",
    {
      preHandler: [authGuard],
      schema: {
        querystring: {
          type: "object",
          properties: {
            sortBy: {
              type: "string",
              enum: ["status", "lastActive", "duration", "name"],
            },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
            status: { type: "string", enum: ["Online", "Offline"] },
          },
        },
      },
    },
    getPlayers,
  );

  app.delete(
    "/:id",
    {
      preHandler: [authGuard],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
      },
    },
    deletePlayer,
  );
  app.post(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "location", "playlistId","deviceKey"],
          properties: {
            name: { type: "string" },
            location: { type: "string" },
            playlistId: { type: "number" },
            deviceKey: { type: "string", minLength: 8, maxLength: 16 },
          },
        },
      },
      preHandler: [authGuard],
    },
    createPlayer,
  );
 app.post(
    "/edit",
    {
      schema: {
        body: {
          type: "object",
          required: ["name", "location", "playlistId","deviceKey","playerId"],
          properties: {
            playerId: { type: "number" },
            name: { type: "string" },
            location: { type: "string" },
            playlistId: { type: "number" },
            deviceKey: { type: "string", minLength: 8, maxLength: 16 },
          },
        },
      },
      preHandler: [authGuard],
    },
    editPlayer,
  );
    app.post(
    "/:playerId/update-playlist",
    {
      preHandler: [authGuard],
      schema: {
        params: {
          type: "object",
          required: ["playerId"],
          properties: { playerId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["playlistId"],
          properties: { playlistId: { type: ["number"] } },
        },
      },
    },
    updatePlayerPlaylist,
  );

  app.get("/get-activity", getActivitySchema, getActivity);
}
