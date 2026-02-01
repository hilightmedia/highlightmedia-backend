import { FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import { StartSessionParams, StartSessionBody, EndSessionParams, EndSessionBody, LinkPlayerBody, CreatePlayLogBody, CreatePlayLogParams, GetPlaylistParams, DbPlaylistFile, DbSubPlaylist, PlaylistDto, PlaylistFileDto, FileDto, DbFile } from "../types/types";
import { toNullableInt } from "../utils/common";


export const linkPlayer = async (
  req: FastifyRequest<{ Body: LinkPlayerBody }>,
  reply: FastifyReply,
) => {
  try {
    const { deviceName, deviceKey } = req.body;

    const player = await prisma.player.findFirst({
      where: {
        AND: [{ name: deviceName }, { deviceKey }],
      },
      select: {
        id: true,
        deviceCode: true,
        linked: true,
        playlistId: true,
        location: true,
      },
    });

    if (!player) return reply.status(404).send({ message: "Player not found" });

    if (!player.linked) {
      await prisma.player.update({
        where: { id: player.id },
        data: { linked: true },
      });
    }

    return reply.status(200).send({
      message: !player.linked
        ? "Player linked successfully"
        : "Player Authenticated Successfully",
      player: {
        id: player.id,
        deviceCode: player.deviceCode,
        playlistId: player.playlistId ?? null,
        location: player.location ?? null,
        linked: true,
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};


export const getPlayList = async (
  req: FastifyRequest<{ Params: GetPlaylistParams }>,
  reply: FastifyReply,
) => {
  try {
    const { deviceCode } = req.params;

    const player = await prisma.player.findUnique({
      where: { deviceCode },
      select: { playlistId: true },
    });

    if (!player) return reply.status(404).send({ message: "Player not found" });
    if (!player.playlistId) return reply.status(200).send({ playlist: null });

    const playlist = await prisma.playlist.findUnique({
      where: { id: Number(player.playlistId) },
      select: {
        id: true,
        name: true,
        defaultDuration: true,
      },
    });

    if (!playlist) return reply.status(200).send({ playlist: null });

    const playlistFiles = (await prisma.playlistFile.findMany({
      where: { playlistId: playlist.id },
      orderBy: { playOrder: "asc" },
      select: {
        id: true,
        playOrder: true,
        duration: true,
        isSubPlaylist: true,
        fileId: true,
        subPlaylistId: true,
        file: {
          select: {
            id: true,
            name: true,
            fileType: true,
            fileKey: true,
            fileSize: true,
            duration: true,
            verified: true,
            folderId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })) as unknown as DbPlaylistFile[];

    return reply.status(200).send({ playlist: {...playlist, playlistFiles } });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};


export const createPlayLog = async (
  req: FastifyRequest<{ Params: CreatePlayLogParams; Body: CreatePlayLogBody }>,
  reply: FastifyReply,
) => {
  try {
    const { deviceCode } = req.params;

    const fileId = Number((req.body as any).fileId);
    const playlistFileId = toNullableInt((req.body as any).playlistFileId);
    const playlistId = toNullableInt((req.body as any).playlistId);
    const subPlaylistIdRaw = toNullableInt((req.body as any).subPlaylistId);
    const isSubPlaylist = Boolean((req.body as any).isSubPlaylist);

    if (!Number.isFinite(fileId) || fileId <= 0) {
      return reply.status(400).send({ message: "Invalid fileId" });
    }

    const player = await prisma.player.findUnique({
      where: { deviceCode, playlistId: { not: null } },
      select: { id: true, playlistId: true },
    });

    if (!player) return reply.status(404).send({ message: "Player not found" });

    if (!playlistId || Number(player.playlistId) !== Number(playlistId)) {
      return reply.status(400).send({ message: "Playlist not found" });
    }

    const subPlaylistId = isSubPlaylist ? subPlaylistIdRaw : null;

    const fileExists = await prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true },
    });
    if (!fileExists) return reply.status(400).send({ message: "File not found" });

    if (playlistFileId) {
      const playlistFileExists = await prisma.playlistFile.findUnique({
        where: { id: playlistFileId },
        select: { id: true, playlistId: true },
      });
      if (!playlistFileExists || Number(playlistFileExists.playlistId) !== Number(playlistId)) {
        return reply.status(400).send({ message: "Invalid playlistFileId" });
      }
    }

    if (subPlaylistId) {
      const subPlaylistExists = await prisma.playlist.findUnique({
        where: { id: subPlaylistId },
        select: { id: true },
      });
      if (!subPlaylistExists) {
        return reply.status(400).send({ message: "Invalid subPlaylistId" });
      }
    }

    const now = new Date();

    const activeSession = await prisma.playerSession.findFirst({
      where: { playerId: player.id, isActive: true, endedAt: null },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    });

    if (activeSession) {
      await prisma.playerSession.update({
        where: { id: activeSession.id },
        data: { lastActiveAt: now, isActive: true },
      });
    }

    const playLog = await prisma.playLog.create({
      data: {
        playerId: player.id,
        playlistFileId,
        fileId,
        playlistId,
        subPlaylistId,
        isSubPlaylist,
        createdAt: now,
      },
      select: { id: true },
    });

    return reply.status(200).send({ message: "Play log created", playLogId: playLog.id });
  } catch (e: any) {
    if (e?.code === "P2003") {
      return reply.status(400).send({ message: "Invalid reference id" });
    }
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};


export const startPlayerSession = async (
  req: FastifyRequest<{ Params: StartSessionParams; Body: StartSessionBody }>,
  reply: FastifyReply,
) => {
  try {
    const { deviceCode } = req.params;
    const { forceNew = false } = req.body ?? {};
    const now = new Date();

    const player = await prisma.player.findUnique({
      where: { deviceCode },
      select: { id: true },
    });

    if (!player) return reply.status(404).send({ message: "Player not found" });

    const activeSession = await prisma.playerSession.findFirst({
      where: { playerId: player.id, isActive: true, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (activeSession && !forceNew) {
      const updated = await prisma.playerSession.update({
        where: { id: activeSession.id },
        data: { lastActiveAt: now, isActive: true },
      });

      return reply.status(200).send({
        message: "Session already active",
        session: {
          ...updated,
          startedAt: updated.startedAt.toISOString(),
          endedAt: updated.endedAt ? updated.endedAt.toISOString() : null,
          lastActiveAt: updated.lastActiveAt.toISOString(),
        },
      });
    }

    if (activeSession && forceNew) {
      await prisma.playerSession.update({
        where: { id: activeSession.id },
        data: { endedAt: now, isActive: false },
      });
    }

    const created = await prisma.playerSession.create({
      data: {
        playerId: player.id,
        startedAt: now,
        lastActiveAt: now,
        isActive: true,
      },
    });

    return reply.status(200).send({
      message: "Session started",
      session: {
        ...created,
        startedAt: created.startedAt.toISOString(),
        endedAt: created.endedAt ? created.endedAt.toISOString() : null,
        lastActiveAt: created.lastActiveAt.toISOString(),
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const endPlayerSession = async (
  req: FastifyRequest<{ Params: EndSessionParams; Body: EndSessionBody }>,
  reply: FastifyReply,
) => {
  try {
    const { deviceCode } = req.params;
    const { endAll = false } = req.body ?? {};
    const now = new Date();

    const player = await prisma.player.findUnique({
      where: { deviceCode },
      select: { id: true },
    });

    if (!player) return reply.status(404).send({ message: "Player not found" });

    if (endAll) {
      const res = await prisma.playerSession.updateMany({
        where: { playerId: player.id, isActive: true, endedAt: null },
        data: { endedAt: now, isActive: false, updatedAt: now },
      });

      return reply.status(200).send({
        message: "Sessions ended",
        endedCount: res.count,
      });
    }

    const activeSession = await prisma.playerSession.findFirst({
      where: { playerId: player.id, isActive: true, endedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    if (!activeSession) {
      return reply.status(200).send({
        message: "No active session",
        endedCount: 0,
      });
    }

    await prisma.playerSession.update({
      where: { id: activeSession.id },
      data: { endedAt: now, isActive: false, updatedAt: now },
    });

    return reply.status(200).send({
      message: "Session ended",
      endedCount: 1,
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

