// src/controllers/analytics.ts
import { FastifyReply, FastifyRequest } from "fastify";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";

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


export const getTopClients = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const range = parseDateRange((req.query as any)?.date);
    const whereDate = range
      ? { createdAt: { gte: range.start, lte: range.end } }
      : {};

    const rows = await prisma.playLog.groupBy({
      by: ["fileId"],
      where: whereDate,
      _count: { fileId: true },
      orderBy: { _count: { fileId: "desc" } },
    });

    if (!rows.length)
      return reply
        .status(200)
        .send({ message: "Top clients fetched", items: [] });

    const fileIds = rows.map((r) => r.fileId);
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: {
        id: true,
        folderId: true,
        folder: { select: { id: true, name: true, isDeleted: true } },
      },
    });

    const countByFileId = new Map<number, number>();
    for (const r of rows) countByFileId.set(r.fileId, r._count?.fileId ?? 0);

    const countByFolderId = new Map<
      number,
      { folderId: number; folderName: string; adsPlayed: number }
    >();

    for (const f of files) {
      const folderId = f.folderId;
      if (!folderId) continue;
      if (f.folder?.isDeleted) continue;

      const folderName = f.folder?.name ?? "";
      const c = countByFileId.get(f.id) ?? 0;

      const cur = countByFolderId.get(folderId);
      if (!cur)
        countByFolderId.set(folderId, { folderId, folderName, adsPlayed: c });
      else cur.adsPlayed += c;
    }

    const items = Array.from(countByFolderId.values())
      .sort((a, b) => b.adsPlayed - a.adsPlayed)
      .slice(0, 5);

    return reply.status(200).send({ message: "Top clients fetched", items });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getTopPlayers = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const range = parseDateRange((req.query as any)?.date);
    const whereDate = range
      ? { createdAt: { gte: range.start, lte: range.end } }
      : {};

    const rows = await prisma.playLog.groupBy({
      by: ["playerId"],
      where: { ...whereDate, playerId: { not: null } },
      _count: { playerId: true },
      orderBy: { _count: { playerId: "desc" } },
      take: 5,
    });

    const ids = rows
      .map((r) => r.playerId)
      .filter((x): x is number => typeof x === "number");
    const players = ids.length
      ? await prisma.player.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];

    const nameById = new Map(players.map((p) => [p.id, p.name]));

    const items = rows.map((r) => ({
      playerId: Number(r.playerId),
      playerName: nameById.get(Number(r.playerId)) ?? "Unknown",
      adsPlayed: r._count?.playerId ?? 0,
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
