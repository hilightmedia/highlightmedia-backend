// src/controllers/analytics.ts
import { FastifyReply, FastifyRequest } from "fastify";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import { TopClientItem, TopPlayerItem } from "../types/types";
import { Prisma } from "@prisma/client";

const parseDateRange = (raw?: unknown) => {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const start = new Date(`${s}T00:00:00.000Z`);
  const end = new Date(`${s}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
};

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

const isOnline = (lastActiveAt?: Date | null, isActive?: boolean | null) => {
  if (!isActive) return false;
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() <= ONLINE_THRESHOLD_MS;
};

export const getAnalyticsSummary = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const [totalFolders, playersCount, activeSessions] = await Promise.all([
      prisma.folder.count({ where: { isDeleted: false } }),
      prisma.player.count(),
      prisma.playerSession.findMany({
        where: { isActive: true, endedAt: null },
        select: { id: true, playerId: true, lastActiveAt: true, isActive: true },
      }),
    ]);

    const now = new Date();

    const offlineSessionIds = activeSessions
      .filter((s) => !isOnline(s.lastActiveAt, s.isActive))
      .map((s) => s.id);

    if (offlineSessionIds.length) {
      await prisma.playerSession.updateMany({
        where: { id: { in: offlineSessionIds }, endedAt: null },
        data: { endedAt: now, isActive: false },
      });
    }

    const onlinePlayerIds = new Set(
      activeSessions
        .filter((s) => isOnline(s.lastActiveAt, s.isActive))
        .map((s) => s.playerId),
    );

    const online = onlinePlayerIds.size;
    const offline = Math.max(0, playersCount - online);

    return reply.status(200).send({
      message: "Analytics summary fetched",
      data: { totalFolders, players: playersCount, online, offline },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};


export const getTopClients = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const range = parseDateRange((req.query as any)?.date);

    const dateJoin = range
      ? Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`
      : Prisma.empty;

    const itemsRaw = await prisma.$queryRaw<
      { folderId: number; folderName: string; adsPlayed: bigint }[]
    >(Prisma.sql`
      SELECT
        fo."id" as "folderId",
        fo."name" as "folderName",
        COUNT(pl."id")::bigint as "adsPlayed"
      FROM "Folders" fo
      LEFT JOIN "Files" f
        ON f."folderId" = fo."id"
       AND f."isDeleted" = false
      LEFT JOIN "PlayLogs" pl
        ON pl."fileId" = f."id"
        ${dateJoin}
      WHERE
        fo."isDeleted" = false
      GROUP BY fo."id", fo."name"
      ORDER BY "adsPlayed" DESC, fo."name" ASC
      LIMIT 4
    `);

    const items: TopClientItem[] = itemsRaw.map((x) => ({
      folderId: x.folderId,
      folderName: x.folderName,
      adsPlayed: Number(x.adsPlayed),
    }));

    return reply.status(200).send({ message: "Top clients fetched", items });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getTopPlayers = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const range = parseDateRange((req.query as any)?.date);

    const dateJoin = range
      ? Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`
      : Prisma.empty;

    const itemsRaw = await prisma.$queryRaw<
      { playerId: number; playerName: string; adsPlayed: bigint }[]
    >(Prisma.sql`
      SELECT
        p."id" as "playerId",
        p."name" as "playerName",
        COUNT(pl."id")::bigint as "adsPlayed"
      FROM "Players" p
      LEFT JOIN "PlayLogs" pl
        ON pl."playerId" = p."id"
        ${dateJoin}
      GROUP BY p."id", p."name"
      ORDER BY "adsPlayed" DESC, p."name" ASC
      LIMIT 5
    `);

    const items: TopPlayerItem[] = itemsRaw.map((x) => ({
      playerId: x.playerId,
      playerName: x.playerName,
      adsPlayed: Number(x.adsPlayed),
    }));

    return reply.status(200).send({ message: "Top players fetched", items });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getRecentPlayerSessions = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const q = (req.query as any) ?? {};
    const range = parseDateRange(q.date);

    const sortBy = typeof q.sortBy === "string" ? q.sortBy : "lastActive";
    const sortOrder = q.sortOrder === "asc" ? "asc" : "desc";

    const whereDate = range
      ? {
          OR: [
            { startedAt: { gte: range.start, lte: range.end } },
            { lastActiveAt: { gte: range.start, lte: range.end } },
            { endedAt: { gte: range.start, lte: range.end } },
          ],
        }
      : {};

    const sessions = await prisma.playerSession.findMany({
      where: whereDate,
      orderBy: [{ startedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        playerId: true,
        startedAt: true,
        endedAt: true,
        lastActiveAt: true,
        isActive: true,
        player: { select: { id: true, name: true } },
      },
    });

    const itemsRaw = sessions.map((s) => {
      const online = isOnline(s.lastActiveAt, s.isActive && !s.endedAt);
      const end = s.endedAt ?? null;
      const start = s.startedAt ?? null;
      const durationMs =
        start && (end || s.lastActiveAt)
          ? (end ?? s.lastActiveAt!).getTime() - start.getTime()
          : 0;

      return {
        playerId: s.playerId,
        name: s.player?.name ?? "Unknown",
        sessionStart: start ? start.toISOString() : null,
        sessionEnd: end ? end.toISOString() : null,
        status: online ? ("Online" as const) : ("Offline" as const),
        lastActive: s.lastActiveAt ? s.lastActiveAt.toISOString() : null,
        sessionDurationSec: Math.max(0, Math.floor(durationMs / 1000)),
      };
    });

    const items = itemsRaw.sort((a, b) => {
      if (sortBy === "name") {
        const av = a.name.toLowerCase();
        const bv = b.name.toLowerCase();
        return sortOrder === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      if (sortBy === "status") {
        const av = a.status;
        const bv = b.status;
        return sortOrder === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      const ad = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const bd = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return sortOrder === "asc" ? ad - bd : bd - ad;
    });

    return reply
      .status(200)
      .send({ message: "Recent player sessions fetched", items });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};
