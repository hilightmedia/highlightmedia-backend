// src/controllers/analytics.ts
import { FastifyReply, FastifyRequest } from "fastify";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import {
  FileLogItem,
  FileLogSortBy,
  FolderLogItem,
  FolderLogSortBy,
  PlaylistFileLogItem,
  PlaylistFileLogSortBy,
  PlaylistLogItem,
  PlaylistLogSortBy,
  SortOrder,
  TopClientItem,
  TopPlayerItem,
} from "../types/types";
import { Prisma } from "@prisma/client";
import { generateSignedUrl } from "../services/file";

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
        select: {
          id: true,
          playerId: true,
          lastActiveAt: true,
          isActive: true,
        },
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

export const getTopPlayers = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
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

export const getFolderLogs = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const q = (req.query ?? {}) as any;

    const range = parseDateRange(q?.date);

    const sortBy: FolderLogSortBy =
      (q?.sortBy as FolderLogSortBy) ?? "lastPlayed";
    const sortOrder: SortOrder = (q?.sortOrder as SortOrder) ?? "desc";

    const offset = Math.max(0, Number(q?.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 10)));

    const searchTerm =
      typeof q?.search === "string" && q.search.trim().length > 0
        ? q.search.trim()
        : null;

    const whereDate = range
      ? Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`
      : Prisma.empty;

    const whereSearch = searchTerm
      ? Prisma.sql`AND fo."name" ILIKE ${"%" + searchTerm + "%"}`
      : Prisma.empty;

    const orderExpr = (() => {
      const dir =
        sortOrder.toLowerCase() === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

      if (sortBy === "name") return Prisma.sql`fo."name" ${dir}`;
      if (sortBy === "plays") return Prisma.sql`"plays" ${dir}, fo."name" ASC`;
      if (sortBy === "devices")
        return Prisma.sql`"devices" ${dir}, fo."name" ASC`;
      if (sortBy === "totalRunTime")
        return Prisma.sql`"totalRunTimeSec" ${dir}, fo."name" ASC`;

      return Prisma.sql`"lastPlayedAt" ${dir} NULLS LAST, fo."name" ASC`;
    })();

    const totalRaw = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "total"
      FROM "Folders" fo
      WHERE fo."isDeleted" = false
      ${whereSearch}
    `);

    const total = Number(totalRaw?.[0]?.total ?? 0);

    const rows = await prisma.$queryRaw<
      {
        folderId: number;
        folderName: string;
        lastPlayedAt: Date | null;
        totalRunTimeSec: bigint;
        devices: bigint;
        plays: bigint;
      }[]
    >(Prisma.sql`
  SELECT
    fo."id" AS "folderId",
    fo."name" AS "folderName",
    MAX(pl."createdAt") AS "lastPlayedAt",
    COALESCE(SUM(COALESCE(pf."duration", 0)), 0)::bigint AS "totalRunTimeSec",
    COUNT(DISTINCT pl."playerId")::bigint AS "devices",
    COUNT(pl."id")::bigint AS "plays"
  FROM "Folders" fo
  LEFT JOIN "Files" f
    ON f."folderId" = fo."id"
   AND f."isDeleted" = false
  LEFT JOIN "PlayLogs" pl
    ON pl."fileId" = f."id"
    ${whereDate}
  LEFT JOIN "PlaylistFiles" pf
    ON pf."id" = pl."playlistFileId"
  WHERE
    fo."isDeleted" = false
    ${whereSearch}
  GROUP BY fo."id", fo."name"
  ORDER BY ${orderExpr}
  OFFSET ${offset}
  LIMIT ${limit}
`);

    const folderIds = rows.map((r) => r.folderId);

    const thumbs = folderIds.length
      ? await prisma.$queryRaw<
          { folderId: number; fileKey: string }[]
        >(Prisma.sql`
          SELECT DISTINCT ON (f."folderId")
            f."folderId" AS "folderId",
            f."fileKey" AS "fileKey"
          FROM "Files" f
          WHERE
            f."folderId" IN (${Prisma.join(folderIds)})
            AND f."isDeleted" = false
            AND f."fileType" ILIKE 'image/%'
          ORDER BY f."folderId", f."createdAt" ASC
        `)
      : [];

    const thumbKeyByFolderId = new Map<number, string>();
    for (const t of thumbs) thumbKeyByFolderId.set(t.folderId, t.fileKey);

    const thumbUrlByFolderId = new Map<number, string>();
    await Promise.all(
      folderIds.map(async (id) => {
        const key = thumbKeyByFolderId.get(id);
        if (!key) return thumbUrlByFolderId.set(id, "");
        try {
          const url = await generateSignedUrl(key);
          thumbUrlByFolderId.set(id, url ?? "");
        } catch {
          thumbUrlByFolderId.set(id, "");
        }
      }),
    );

    const items: FolderLogItem[] = rows.map((r) => ({
      folderId: r.folderId,
      folderName: r.folderName,
      thumbnail: thumbUrlByFolderId.get(r.folderId) ?? "",
      lastPlayedAt: r.lastPlayedAt ?? null,
      totalRunTimeSec: Number(r.totalRunTimeSec ?? 0n),
      devices: Number(r.devices ?? 0n),
      plays: Number(r.plays ?? 0n),
    }));

    return reply.status(200).send({
      message: "Folder logs fetched",
      items,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: {
        sortBy,
        sortOrder,
        search: searchTerm,
        date: range
          ? { start: range.start.toISOString(), end: range.end.toISOString() }
          : null,
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};


export const getFileLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = (req.query ?? {}) as any;

    const range = parseDateRange(q?.date);

    const sortBy: FileLogSortBy = (q?.sortBy as FileLogSortBy) ?? "lastPlayed";
    const sortOrder: SortOrder = (q?.sortOrder as SortOrder) ?? "desc";

    const offset = Math.max(0, Number(q?.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 10)));

    const searchTerm =
      typeof q?.search === "string" && q.search.trim().length > 0 ? q.search.trim() : null;

    const whereDate = range
      ? Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`
      : Prisma.empty;

    const whereSearch = searchTerm
      ? Prisma.sql`AND (f."name" ILIKE ${"%" + searchTerm + "%"} OR fo."name" ILIKE ${"%" + searchTerm + "%"})`
      : Prisma.empty;

    const orderExpr = (() => {
      const dir = String(sortOrder).toLowerCase() === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

      if (sortBy === "name") return Prisma.sql`f."name" ${dir}`;
      if (sortBy === "plays") return Prisma.sql`"plays" ${dir}, f."name" ASC`;
      if (sortBy === "devices") return Prisma.sql`"devices" ${dir}, f."name" ASC`;
      if (sortBy === "totalRunTime") return Prisma.sql`"totalRunTimeSec" ${dir}, f."name" ASC`;

      return Prisma.sql`"lastPlayedAt" ${dir} NULLS LAST, f."name" ASC`;
    })();

    const totalRaw = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "total"
      FROM "Files" f
      JOIN "Folders" fo
        ON fo."id" = f."folderId"
       AND fo."isDeleted" = false
      WHERE
        f."isDeleted" = false
        ${whereSearch}
    `);

    const total = Number(totalRaw?.[0]?.total ?? 0);

    const rows = await prisma.$queryRaw<
      {
        fileId: number;
        fileName: string;
        fileType: string;
        fileKey: string;
        folderId: number;
        folderName: string;
        lastPlayedAt: Date | null;
        totalRunTimeSec: bigint;
        devices: bigint;
        plays: bigint;
      }[]
    >(Prisma.sql`
      SELECT
        f."id" AS "fileId",
        f."name" AS "fileName",
        f."fileType" AS "fileType",
        f."fileKey" AS "fileKey",
        fo."id" AS "folderId",
        fo."name" AS "folderName",
        MAX(pl."createdAt") AS "lastPlayedAt",
        COALESCE(SUM(COALESCE(pf."duration", 0)), 0)::bigint AS "totalRunTimeSec",
        COUNT(DISTINCT pl."playerId")::bigint AS "devices",
        COUNT(pl."id")::bigint AS "plays"
      FROM "Files" f
      JOIN "Folders" fo
        ON fo."id" = f."folderId"
       AND fo."isDeleted" = false
      LEFT JOIN "PlayLogs" pl
        ON pl."fileId" = f."id"
        ${whereDate}
      LEFT JOIN "PlaylistFiles" pf
        ON pf."id" = pl."playlistFileId"
      WHERE
        f."isDeleted" = false
        ${whereSearch}
      GROUP BY
        f."id", f."name", f."fileType", f."fileKey",
        fo."id", fo."name"
      ORDER BY ${orderExpr}
      OFFSET ${offset}
      LIMIT ${limit}
    `);

    const signedUrlByKey = new Map<string, string>();
    await Promise.all(
      rows.map(async (r) => {
        if (!r.fileKey) return signedUrlByKey.set(r.fileKey, "");
        try {
          const url = await generateSignedUrl(r.fileKey);
          signedUrlByKey.set(r.fileKey, url ?? "");
        } catch {
          signedUrlByKey.set(r.fileKey, "");
        }
      }),
    );

    const items: FileLogItem[] = rows.map((r) => ({
      fileId: r.fileId,
      fileName: r.fileName,
      fileType: r.fileType,
      folderId: r.folderId,
      folderName: r.folderName,
      signedUrl: signedUrlByKey.get(r.fileKey) ?? "",
      lastPlayedAt: r.lastPlayedAt ?? null,
      totalRunTimeSec: Number(r.totalRunTimeSec ?? 0n),
      devices: Number(r.devices ?? 0n),
      plays: Number(r.plays ?? 0n),
    }));

    return reply.status(200).send({
      message: "File logs fetched",
      items,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: {
        sortBy,
        sortOrder,
        search: searchTerm,
        date: range ? { start: range.start.toISOString(), end: range.end.toISOString() } : null,
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getPlaylistFileLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = (req.query ?? {}) as any;

    const range = parseDateRange(q?.date);

    const sortBy: PlaylistFileLogSortBy = (q?.sortBy as PlaylistFileLogSortBy) ?? "lastPlayed";
    const sortOrder: SortOrder = (q?.sortOrder as SortOrder) ?? "desc";

    const offset = Math.max(0, Number(q?.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 10)));

    const searchTerm =
      typeof q?.search === "string" && q.search.trim().length > 0 ? q.search.trim() : null;

    const playlistId = q?.playlistId != null ? Number(q.playlistId) : null;

    const whereDate = range
      ? Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`
      : Prisma.empty;

    const whereSearch = searchTerm
      ? Prisma.sql`AND (
          p."name" ILIKE ${"%" + searchTerm + "%"}
          OR f."name" ILIKE ${"%" + searchTerm + "%"}
          OR sp."name" ILIKE ${"%" + searchTerm + "%"}
        )`
      : Prisma.empty;

    const wherePlaylist = Number.isFinite(playlistId)
      ? Prisma.sql`AND pf0."playlistId" = ${playlistId}`
      : Prisma.empty;

    const orderExpr = (() => {
      const dir = String(sortOrder).toLowerCase() === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

      if (sortBy === "name")
        return Prisma.sql`COALESCE(f."name", sp."name", '') ${dir}, p."name" ASC`;

      if (sortBy === "plays") return Prisma.sql`"plays" ${dir}, p."name" ASC`;
      if (sortBy === "devices") return Prisma.sql`"devices" ${dir}, p."name" ASC`;
      if (sortBy === "totalRunTime") return Prisma.sql`"totalRunTimeSec" ${dir}, p."name" ASC`;

      return Prisma.sql`"lastPlayedAt" ${dir} NULLS LAST, p."name" ASC`;
    })();

    const totalRaw = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "total"
      FROM "PlaylistFiles" pf0
      JOIN "Playlist" p ON p."id" = pf0."playlistId"
      LEFT JOIN "Files" f ON f."id" = pf0."fileId"
      LEFT JOIN "Playlist" sp ON sp."id" = pf0."subPlaylistId"
      WHERE 1=1
        ${wherePlaylist}
        ${whereSearch}
    `);

    const total = Number(totalRaw?.[0]?.total ?? 0);

    const rows = await prisma.$queryRaw<
      {
        playlistFileId: number;
        playlistId: number;
        playlistName: string;
        playOrder: number;
        isSubPlaylist: boolean;
        fileId: number | null;
        fileName: string | null;
        fileType: string | null;
        fileKey: string | null;
        subPlaylistId: number | null;
        subPlaylistName: string | null;
        lastPlayedAt: Date | null;
        totalRunTimeSec: bigint;
        devices: bigint;
        plays: bigint;
      }[]
    >(Prisma.sql`
      SELECT
        pf0."id" AS "playlistFileId",
        pf0."playlistId" AS "playlistId",
        p."name" AS "playlistName",
        pf0."playOrder" AS "playOrder",
        pf0."isSubPlaylist" AS "isSubPlaylist",
        pf0."fileId" AS "fileId",
        f."name" AS "fileName",
        f."fileType" AS "fileType",
        f."fileKey" AS "fileKey",
        pf0."subPlaylistId" AS "subPlaylistId",
        sp."name" AS "subPlaylistName",
        MAX(pl."createdAt") AS "lastPlayedAt",
        COALESCE(SUM(COALESCE(pf1."duration", 0)), 0)::bigint AS "totalRunTimeSec",
        COUNT(DISTINCT pl."playerId")::bigint AS "devices",
        COUNT(pl."id")::bigint AS "plays"
      FROM "PlaylistFiles" pf0
      JOIN "Playlist" p ON p."id" = pf0."playlistId"
      LEFT JOIN "Files" f ON f."id" = pf0."fileId"
      LEFT JOIN "Playlist" sp ON sp."id" = pf0."subPlaylistId"
      LEFT JOIN "PlayLogs" pl
        ON pl."playlistFileId" = pf0."id"
        ${whereDate}
      LEFT JOIN "PlaylistFiles" pf1
        ON pf1."id" = pl."playlistFileId"
      WHERE 1=1
        ${wherePlaylist}
        ${whereSearch}
      GROUP BY
        pf0."id", pf0."playlistId", p."name", pf0."playOrder", pf0."isSubPlaylist",
        pf0."fileId", f."name", f."fileType", f."fileKey",
        pf0."subPlaylistId", sp."name"
      ORDER BY ${orderExpr}
      OFFSET ${offset}
      LIMIT ${limit}
    `);

    const signedUrlByKey = new Map<string, string>();
    await Promise.all(
      rows.map(async (r) => {
        const key = r.fileKey ?? "";
        if (!key) return signedUrlByKey.set(key, "");
        if (signedUrlByKey.has(key)) return;
        try {
          const url = await generateSignedUrl(key);
          signedUrlByKey.set(key, url ?? "");
        } catch {
          signedUrlByKey.set(key, "");
        }
      }),
    );

    const items: PlaylistFileLogItem[] = rows.map((r) => ({
      playlistFileId: r.playlistFileId,
      playlistId: r.playlistId,
      playlistName: r.playlistName,
      playOrder: r.playOrder,
      isSubPlaylist: Boolean(r.isSubPlaylist),
      fileId: r.fileId ?? null,
      fileName: r.fileName ?? null,
      fileType: r.fileType ?? null,
      signedUrl: r.fileKey ? signedUrlByKey.get(r.fileKey) ?? "" : "",
      subPlaylistId: r.subPlaylistId ?? null,
      subPlaylistName: r.subPlaylistName ?? null,
      lastPlayedAt: r.lastPlayedAt ?? null,
      totalRunTimeSec: Number(r.totalRunTimeSec ?? 0n),
      devices: Number(r.devices ?? 0n),
      plays: Number(r.plays ?? 0n),
    }));

    return reply.status(200).send({
      message: "Playlist file logs fetched",
      items,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: {
        sortBy,
        sortOrder,
        search: searchTerm,
        playlistId: Number.isFinite(playlistId) ? playlistId : null,
        date: range ? { start: range.start.toISOString(), end: range.end.toISOString() } : null,
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getPlaylistLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = (req.query ?? {}) as any;

    const range = parseDateRange(q?.date);

    const sortBy: PlaylistLogSortBy = (q?.sortBy as PlaylistLogSortBy) ?? "lastPlayed";
    const sortOrder: SortOrder = (q?.sortOrder as SortOrder) ?? "desc";

    const offset = Math.max(0, Number(q?.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 10)));

    const searchTerm =
      typeof q?.search === "string" && q.search.trim().length > 0 ? q.search.trim() : null;

    const whereDate = range
      ? Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`
      : Prisma.empty;

    const whereSearch = searchTerm
      ? Prisma.sql`AND p."name" ILIKE ${"%" + searchTerm + "%"}`
      : Prisma.empty;

    const orderExpr = (() => {
      const dir = String(sortOrder).toLowerCase() === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

      if (sortBy === "name") return Prisma.sql`p."name" ${dir}`;
      if (sortBy === "plays") return Prisma.sql`"plays" ${dir}, p."name" ASC`;
      if (sortBy === "devices") return Prisma.sql`"devices" ${dir}, p."name" ASC`;
      if (sortBy === "totalRunTime") return Prisma.sql`"totalRunTimeSec" ${dir}, p."name" ASC`;

      return Prisma.sql`"lastPlayedAt" ${dir} NULLS LAST, p."name" ASC`;
    })();

    const totalRaw = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "total"
      FROM "Playlist" p
      ${whereSearch ? Prisma.sql`WHERE 1=1 ${whereSearch}` : Prisma.empty}
    `);

    const total = Number(totalRaw?.[0]?.total ?? 0);

    const rows = await prisma.$queryRaw<
      {
        playlistId: number;
        playlistName: string;
        lastPlayedAt: Date | null;
        totalRunTimeSec: bigint;
        devices: bigint;
        plays: bigint;
      }[]
    >(Prisma.sql`
      SELECT
        p."id" AS "playlistId",
        p."name" AS "playlistName",
        MAX(pl."createdAt") AS "lastPlayedAt",
        COALESCE(SUM(COALESCE(pf."duration", 0)), 0)::bigint AS "totalRunTimeSec",
        COUNT(DISTINCT pl."playerId")::bigint AS "devices",
        COUNT(pl."id")::bigint AS "plays"
      FROM "Playlist" p
      LEFT JOIN "PlayLogs" pl
        ON pl."playlistId" = p."id"
        ${whereDate}
      LEFT JOIN "PlaylistFiles" pf
        ON pf."id" = pl."playlistFileId"
      WHERE 1=1
        ${whereSearch}
      GROUP BY p."id", p."name"
      ORDER BY ${orderExpr}
      OFFSET ${offset}
      LIMIT ${limit}
    `);

    const items: PlaylistLogItem[] = rows.map((r) => ({
      playlistId: r.playlistId,
      playlistName: r.playlistName,
      lastPlayedAt: r.lastPlayedAt ?? null,
      totalRunTimeSec: Number(r.totalRunTimeSec ?? 0n),
      devices: Number(r.devices ?? 0n),
      plays: Number(r.plays ?? 0n),
    }));

    return reply.status(200).send({
      message: "Playlist logs fetched",
      items,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: {
        sortBy,
        sortOrder,
        search: searchTerm,
        date: range ? { start: range.start.toISOString(), end: range.end.toISOString() } : null,
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};