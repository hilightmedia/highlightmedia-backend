import { FastifyInstance } from "fastify";
import {
  linkPlayerSchema,
  getPlaylistSchema,
  createPlayLogSchema,
  startPlayerSessionSchema,
  endPlayerSessionSchema,
} from "../schemas/tvapp";
import {
  linkPlayer,
  getPlayList,
  createPlayLog,
  startPlayerSession,
  endPlayerSession,
} from "../controllers/tvapp";
import { LinkPlayerBody } from "../types/types";

type DeviceCodeParams = { deviceCode: string };
export default async function tvAppRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: LinkPlayerBody }>(
    "/player/link",
    linkPlayerSchema,
    linkPlayer,
  );

  fastify.get<{ Params: DeviceCodeParams }>(
    "/player/:deviceCode/playlist/:playlistId?",
    getPlaylistSchema,
    getPlayList,
  );

  fastify.post<{ Params: DeviceCodeParams; Body: any }>(
    "/player/:deviceCode/playlogs",
    createPlayLogSchema,
    createPlayLog,
  );

  fastify.post<{ Params: DeviceCodeParams; Body: { forceNew?: boolean } }>(
    "/player/:deviceCode/session/start",
    startPlayerSessionSchema,
    startPlayerSession,
  );

  fastify.post<{ Params: DeviceCodeParams; Body: { endAll?: boolean } }>(
    "/player/:deviceCode/session/end",
    endPlayerSessionSchema,
    endPlayerSession,
  );
}
