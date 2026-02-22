import { FastifyReply, FastifyRequest } from "fastify";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import { compare, diffSec, formatTime } from "../utils/common";
import {
  ActivityItem,
  PlayerRow,
  PlayerSortBy,
  PlayerStatusFilter,
  SortOrder,
} from "../types/types";
import { generateUnique16Hex } from "../services/deviceCode";
import { ONLINE_THRESHOLD_MS } from "../config/constants";

export const getPlayers = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const now = new Date();

    const inactiveSessions = await prisma.playerSession.findMany({
      where: {
        isActive: true,
        lastActiveAt: {
          lt: new Date(Date.now() - ONLINE_THRESHOLD_MS),
        },
      },
      select: { id: true },
    });

    if (inactiveSessions.length) {
      await prisma.playerSession.updateMany({
        where: {
          id: { in: inactiveSessions.map((s) => s.id) },
        },
        data: {
          isActive: false,
          endedAt: now,
        },
      });
    }

    const {
      sortBy = "lastActive",
      sortOrder = "desc",
      status,
      search,
    } = (req.query as any) ?? {};

    const parsedSortBy = (sortBy as PlayerSortBy) ?? "lastActive";
    const parsedSortOrder = (sortOrder as SortOrder) ?? "desc";
    const statusFilter =
      (status as PlayerStatusFilter | undefined) ?? undefined;

    const searchTerm =
      typeof search === "string" && search.trim().length > 0
        ? search.trim()
        : null;

    const players = await prisma.player.findMany({
      orderBy: { updatedAt: "desc" },
      where: {
        ...(searchTerm
          ? { name: { contains: searchTerm, mode: "insensitive" as const } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        location: true,
        linked: true,
        updatedAt: true,
        playlist: { select: { id: true, name: true } },
        deviceCode: true,
        deviceKey: true,
        sessions: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            isActive: true,
            lastActiveAt: true,
            updatedAt: true,
          },
        },
      },
    });

    let rows: PlayerRow[] = players.map((p: any) => {
      const s = p.sessions[0] ?? null;
      const status: "Online" | "Offline" = s?.isActive ? "Online" : "Offline";

      const sessionStart = s?.startedAt ?? null;
      const sessionEnd = s?.endedAt ?? null;

      const sessionDurationSec = s?.startedAt
        ? s.isActive
          ? diffSec(now, s.startedAt)
          : s.endedAt
          ? diffSec(s.endedAt, s.startedAt)
          : null
        : null;

      const lastActiveCandidates: Date[] = [];
      if (s?.isActive && s.startedAt) lastActiveCandidates.push(s.startedAt);
      if (s?.lastActiveAt) lastActiveCandidates.push(s.lastActiveAt);
      if (s?.endedAt) lastActiveCandidates.push(s.endedAt);
      if (s?.updatedAt) lastActiveCandidates.push(s.updatedAt);
      if (p.updatedAt) lastActiveCandidates.push(p.updatedAt);

      const lastActive =
        lastActiveCandidates.length > 0
          ? new Date(Math.max(...lastActiveCandidates.map((d) => d.getTime())))
          : null;

      return {
        id: p.id,
        name: p.name,
        playlist: p.playlist?.name ?? null,
        playlistId: p.playlist?.id ?? null,
        sessionStart,
        sessionEnd,
        status,
        lastActive,
        sessionDurationSec,
        linked: p.linked,
        location: p.location,
        deviceCode: p.deviceCode,
        deviceKey: p.deviceKey,
      };
    });

    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);

    rows.sort((a, b) => {
      switch (parsedSortBy) {
        case "name":
          return compare(
            a.name.toLowerCase(),
            b.name.toLowerCase(),
            parsedSortOrder,
          );
        case "status":
          return compare(a.status, b.status, parsedSortOrder);
        case "duration": {
          const aVal = a.sessionDurationSec ?? Number.POSITIVE_INFINITY;
          const bVal = b.sessionDurationSec ?? Number.POSITIVE_INFINITY;
          return compare(aVal, bVal, parsedSortOrder);
        }
        case "lastActive":
        default: {
          const aVal = a.lastActive?.getTime() ?? Number.POSITIVE_INFINITY;
          const bVal = b.lastActive?.getTime() ?? Number.POSITIVE_INFINITY;
          return compare(aVal, bVal, parsedSortOrder);
        }
      }
    });

    return reply.status(200).send({
      message: "Players fetched successfully",
      players: rows,
      meta: {
        sortBy: parsedSortBy,
        sortOrder: parsedSortOrder,
        search: searchTerm,
        filters: { status: statusFilter ?? null },
      },
    });
  } catch (e) {
    console.log("Get players error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const createPlayer = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { name, location, playlistId, deviceKey } = req.body as {
      name: string;
      location: string;
      playlistId: number;
      deviceKey: string;
    };
    if (!name?.trim())
      return reply.status(400).send({ message: "Name is required" });
    if (!location?.trim())
      return reply.status(400).send({ message: "Location is required" });
    const pl = await prisma.playlist.findUnique({
      where: { id: Number(playlistId) },
      select: { id: true },
    });
    if (!pl) return reply.status(404).send({ message: "Playlist not found" });
    const deviceCode = await generateUnique16Hex("deviceCode");
    await prisma.player.create({
      data: {
        name: name.trim(),
        location: location.trim(),
        playlistId: playlistId,
        deviceCode,
        deviceKey: deviceKey.trim(),
        linked: false,
      },
    });
    return reply.status(201).send({ message: "Player created successfully" });
  } catch (e) {
    console.log("Create player error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const editPlayer = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { name, location, playlistId, deviceKey, playerId } = req.body as {
      playerId: number;
      name: string;
      location: string;
      playlistId: number;
      deviceKey: string;
    };
    if (!name?.trim())
      return reply.status(400).send({ message: "Name is required" });
    if (!location?.trim())
      return reply.status(400).send({ message: "Location is required" });
    const pl = await prisma.playlist.findUnique({
      where: { id: Number(playlistId) },
      select: { id: true },
    });
    if (!pl) return reply.status(404).send({ message: "Playlist not found" });
    await prisma.player.update({
      where: { id: Number(playerId) },
      data: {
        name: name.trim(),
        location: location.trim(),
        playlistId: playlistId,
        deviceKey: deviceKey.trim(),
      },
    });
    return reply.status(201).send({ message: "Player created successfully" });
  } catch (e) {
    console.log("Create player error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const deletePlayer = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { id } = req.params as { id: string };
    const playerId = Number(id);

    if (!Number.isFinite(playerId)) {
      return reply.status(400).send({ message: "Invalid player id" });
    }

    const existing = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true },
    });

    if (!existing)
      return reply.status(404).send({ message: "Player not found" });

    await prisma.$transaction(async (tx) => {
      await tx.playerSession.deleteMany({ where: { playerId } });
      await tx.playLog.updateMany({
        where: { playerId },
        data: { playerId: null },
      });
      await tx.player.delete({ where: { id: playerId } });
    });

    return reply.status(200).send({ message: "Player deleted successfully" });
  } catch (e) {
    console.log("Delete player error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const updatePlayerPlaylist = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { playerId } = req.params as { playerId: string };
    const { playlistId } = req.body as { playlistId: number };

    const pid = Number(playerId);
    if (!Number.isFinite(pid)) {
      return reply.status(400).send({ message: "Invalid playerId" });
    }

    const pl = await prisma.playlist.findUnique({
      where: { id: Number(playlistId) },
      select: { id: true },
    });
    if (!pl) return reply.status(404).send({ message: "Playlist not found" });

    const player = await prisma.player.findUnique({
      where: { id: pid },
      select: { id: true },
    });
    if (!player) return reply.status(404).send({ message: "Player not found" });

    await prisma.player.update({
      where: { id: pid },
      data: { playlistId: playlistId },
    });

    return reply.status(200).send({ message: "Playlist updated successfully" });
  } catch (e) {
    console.log("Update player playlist error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getActivity = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = (req.query ?? {}) as { offset?: string | number; limit?: string | number };

    const offset = Math.max(0, Number(q.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 10)));

    const [totalSessions, totalEnded] = await Promise.all([
      prisma.playerSession.count(),
      prisma.playerSession.count({ where: { endedAt: { not: null } } }),
    ]);

    const total = totalSessions + totalEnded;

    const take = Math.min(500, offset + limit);

    const sessions = await prisma.playerSession.findMany({
      orderBy: { startedAt: "desc" },
      take,
      include: { player: { select: { id: true, name: true } } },
    });

    const all: ActivityItem[] = [];

    for (const s of sessions) {
      const playerId = s.player?.id ?? s.playerId;
      const playerName = s.player?.name ?? "Unknown";

      all.push({
        id: `session:${s.id}:online`,
        type: "ONLINE",
        playerId,
        playerName,
        at: s.startedAt,
        message: `Player - ${playerName} came Online | ${formatTime(s.startedAt)}`,
      });

      if (s.endedAt) {
        all.push({
          id: `session:${s.id}:offline`,
          type: "OFFLINE",
          playerId,
          playerName,
          at: s.endedAt,
          message: `Player - ${playerName} went offline | ${formatTime(s.endedAt)}`,
        });
      }
    }

    all.sort((a, b) => b.at.getTime() - a.at.getTime());

    const items = all.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return reply.status(200).send({
      activity: items.map((x) => ({
        id: x.id,
        type: x.type,
        playerId: x.playerId,
        playerName: x.playerName,
        at: x.at,
        message: x.message,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

