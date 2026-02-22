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
import { isOnline, parseDateRange, parseRange } from "../utils/common";

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
    if (!range)
      return reply.status(400).send({ message: "Invalid date range" });

    const dateJoin = range
      ? Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`
      : Prisma.empty;

    const itemsRaw = await prisma.$queryRaw<
      {
        folderId: number;
        folderName: string;
        adsPlayed: bigint;
        sortOrder: number;
      }[]
    >(Prisma.sql`
      WITH folder_device_counts AS (
        SELECT
          fo."id" as "folderId",
          fo."name" as "folderName",
          COUNT(DISTINCT pl."playerId")::bigint as "deviceCount"
        FROM "Folders" fo
        LEFT JOIN "Files" f
          ON f."folderId" = fo."id"
         AND f."isDeleted" = false
        LEFT JOIN "PlayLogs" pl
          ON pl."fileId" = f."id"
         AND pl."playerId" IS NOT NULL
          ${dateJoin}
        WHERE
          fo."isDeleted" = false
        GROUP BY fo."id", fo."name"
      ),
      ranked AS (
        SELECT
          "folderId",
          "folderName",
          "deviceCount",
          ROW_NUMBER() OVER (ORDER BY "deviceCount" DESC, "folderName" ASC) as rn
        FROM folder_device_counts
      ),
      top5 AS (
        SELECT
          "folderId",
          "folderName",
          "deviceCount" as "adsPlayed",
          0 as "sortOrder"
        FROM ranked
        WHERE rn <= 5
      ),
      others AS (
        SELECT
          0 as "folderId",
          'Others' as "folderName",
          COALESCE(SUM("deviceCount"), 0)::bigint as "adsPlayed",
          1 as "sortOrder"
        FROM ranked
        WHERE rn > 5
      )
      SELECT * FROM top5
      UNION ALL
      SELECT * FROM others
      ORDER BY "sortOrder" ASC, "adsPlayed" DESC, "folderName" ASC
    `);

    const items: TopClientItem[] = itemsRaw
      .filter((x) => !(x.folderId === 0 && Number(x.adsPlayed) === 0))
      .map((x) => ({
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
    if (!range)
      return reply.status(400).send({ message: "Invalid date range" });

    const dateJoin = Prisma.sql`AND pl."createdAt" >= ${range.start} AND pl."createdAt" <= ${range.end}`;

    const itemsRaw = await prisma.$queryRaw<
      {
        playerId: number;
        playerName: string;
        adsPlayed: bigint;
        sortOrder: number;
      }[]
    >(Prisma.sql`
      WITH player_folder_counts AS (
        SELECT
          p."id" as "playerId",
          p."name" as "playerName",
          COUNT(DISTINCT f."folderId")::bigint as "folderCount"
        FROM "Players" p
        LEFT JOIN "PlayLogs" pl
          ON pl."playerId" = p."id"
          ${dateJoin}
        LEFT JOIN "Files" f
          ON f."id" = pl."fileId"
         AND f."isDeleted" = false
        LEFT JOIN "Folders" fo
          ON fo."id" = f."folderId"
         AND fo."isDeleted" = false
        GROUP BY p."id", p."name"
      ),
      ranked AS (
        SELECT
          "playerId",
          "playerName",
          "folderCount",
          ROW_NUMBER() OVER (ORDER BY "folderCount" DESC, "playerName" ASC) as rn
        FROM player_folder_counts
      ),
      top5 AS (
        SELECT
          "playerId",
          "playerName",
          "folderCount" as "adsPlayed",
          0 as "sortOrder"
        FROM ranked
        WHERE rn <= 5
      ),
      others AS (
        SELECT
          0 as "playerId",
          'Others' as "playerName",
          COALESCE(SUM("folderCount"), 0)::bigint as "adsPlayed",
          1 as "sortOrder"
        FROM ranked
        WHERE rn > 5
      )
      SELECT * FROM top5
      UNION ALL
      SELECT * FROM others
      ORDER BY "sortOrder" ASC, "adsPlayed" DESC, "playerName" ASC
    `);

    const items: TopPlayerItem[] = itemsRaw
      .filter((x) => !(x.playerId === 0 && Number(x.adsPlayed) === 0))
      .map((x) => ({
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

    if (!range)
      return reply.status(400).send({ message: "Invalid date range" });

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

    const range = parseRange(q?.startDate, q?.endDate);
    console.log(range, "Range");
    if (!range)
      return reply.status(400).send({ message: "Invalid date range" });

    const sortBy: FolderLogSortBy =
      (q?.sortBy as FolderLogSortBy) ?? "lastPlayed";
    const sortOrder: SortOrder = (q?.sortOrder as SortOrder) ?? "desc";

    const offset = Math.max(0, Number(q?.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 10)));

    const searchTerm =
      typeof q?.search === "string" && q.search.trim().length > 0
        ? q.search.trim()
        : null;

    const logs = await prisma.playLog.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        file: {
          isDeleted: false,
          folder: {
            isDeleted: false,
            ...(searchTerm && {
              name: { contains: searchTerm, mode: "insensitive" },
            }),
          },
        },
      },
      select: {
        playerId: true,
        createdAt: true,
        file: {
          select: {
            folderId: true,
            folder: { select: { name: true } },
          },
        },
        playlistFile: { select: { duration: true } },
      },
    });

    const map = new Map<
      number,
      {
        folderId: number;
        folderName: string;
        plays: number;
        devices: Set<number>;
        lastPlayedAt: Date | null;
        totalRunTimeSec: number;
      }
    >();

    for (const l of logs) {
      const folderId = l.file.folderId;
      if (!map.has(folderId)) {
        map.set(folderId, {
          folderId,
          folderName: l.file.folder.name,
          plays: 0,
          devices: new Set(),
          lastPlayedAt: null,
          totalRunTimeSec: 0,
        });
      }

      const item = map.get(folderId)!;

      item.plays += 1;

      if (l.playerId) item.devices.add(l.playerId);

      if (!item.lastPlayedAt || l.createdAt > item.lastPlayedAt)
        item.lastPlayedAt = l.createdAt;

      item.totalRunTimeSec += l.playlistFile?.duration ?? 0;
    }

    const mapped = Array.from(map.values()).map((m) => ({
      folderId: m.folderId,
      folderName: m.folderName,
      plays: m.plays,
      devices: m.devices.size,
      lastPlayedAt: m.lastPlayedAt,
      totalRunTimeSec: m.totalRunTimeSec,
    }));

    const dir = sortOrder === "asc" ? 1 : -1;

    mapped.sort((a, b) => {
      if (sortBy === "name")
        return a.folderName.localeCompare(b.folderName) * dir;

      if (sortBy === "plays") return (a.plays - b.plays) * dir;

      if (sortBy === "devices") return (a.devices - b.devices) * dir;

      if (sortBy === "totalRunTime")
        return (a.totalRunTimeSec - b.totalRunTimeSec) * dir;

      const at = a.lastPlayedAt?.getTime() ?? 0;
      const bt = b.lastPlayedAt?.getTime() ?? 0;
      return (at - bt) * dir;
    });

    const total = mapped.length;

    const paginated = mapped.slice(offset, offset + limit);

    const folderIds = paginated.map((r) => r.folderId);

    const thumbs = folderIds.length
      ? await prisma.file.findMany({
          where: {
            folderId: { in: folderIds },
            isDeleted: false,
            fileType: { startsWith: "image/" },
          },
          orderBy: { createdAt: "asc" },
          distinct: ["folderId"],
          select: {
            folderId: true,
            fileKey: true,
          },
        })
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

    const items: FolderLogItem[] = paginated.map((r) => ({
      folderId: r.folderId,
      folderName: r.folderName,
      thumbnail: thumbUrlByFolderId.get(r.folderId) ?? "",
      lastPlayedAt: r.lastPlayedAt ?? null,
      totalRunTimeSec: r.totalRunTimeSec,
      devices: r.devices,
      plays: r.plays,
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
        date: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    console.log(e, status, payload);
    return reply.status(status).send({
      message: payload.error || "Internal server error",
    });
  }
};
export const getFileLogs = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const q = (req.query ?? {}) as any;

    const range = parseRange(q?.startDate, q?.endDate);

    if (!range)
      return reply.status(400).send({ message: "Invalid date range" });

    const sortBy: FileLogSortBy = (q?.sortBy as FileLogSortBy) ?? "lastPlayed";
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
      ? Prisma.sql`AND (f."name" ILIKE ${"%" + searchTerm + "%"} OR fo."name" ILIKE ${"%" + searchTerm + "%"})`
      : Prisma.empty;

    const orderExpr = (() => {
      const dir =
        String(sortOrder).toLowerCase() === "asc"
          ? Prisma.sql`ASC`
          : Prisma.sql`DESC`;

      if (sortBy === "name") return Prisma.sql`f."name" ${dir}`;
      if (sortBy === "plays") return Prisma.sql`"plays" ${dir}, f."name" ASC`;
      if (sortBy === "devices")
        return Prisma.sql`"devices" ${dir}, f."name" ASC`;
      if (sortBy === "totalRunTime")
        return Prisma.sql`"totalRunTimeSec" ${dir}, f."name" ASC`;

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

export const getPlaylistFileLogs = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const q = (req.query ?? {}) as any;

    const range = parseRange(q?.startDate, q?.endDate);

    if (!range)
      return reply.status(400).send({ message: "Invalid date range" });

    const sortBy: PlaylistFileLogSortBy =
      (q?.sortBy as PlaylistFileLogSortBy) ?? "lastPlayed";
    const sortOrder: SortOrder = (q?.sortOrder as SortOrder) ?? "desc";

    const offset = Math.max(0, Number(q?.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q?.limit ?? 10)));

    const searchTerm =
      typeof q?.search === "string" && q.search.trim().length > 0
        ? q.search.trim()
        : null;

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
      const dir =
        String(sortOrder).toLowerCase() === "asc"
          ? Prisma.sql`ASC`
          : Prisma.sql`DESC`;

      if (sortBy === "name")
        return Prisma.sql`COALESCE(f."name", sp."name", '') ${dir}, p."name" ASC`;

      if (sortBy === "plays") return Prisma.sql`"plays" ${dir}, p."name" ASC`;
      if (sortBy === "devices")
        return Prisma.sql`"devices" ${dir}, p."name" ASC`;
      if (sortBy === "totalRunTime")
        return Prisma.sql`"totalRunTimeSec" ${dir}, p."name" ASC`;

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
      signedUrl: r.fileKey ? (signedUrlByKey.get(r.fileKey) ?? "") : "",
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

export const getPlaylistLogs = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const q = (req.query ?? {}) as any;

    const range = parseRange(q?.startDate, q?.endDate);

    if (!range)
      return reply.status(400).send({ message: "Invalid date range" });

    const sortBy: PlaylistLogSortBy =
      (q?.sortBy as PlaylistLogSortBy) ?? "lastPlayed";
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
      ? Prisma.sql`AND p."name" ILIKE ${"%" + searchTerm + "%"}`
      : Prisma.empty;

    const orderExpr = (() => {
      const dir =
        String(sortOrder).toLowerCase() === "asc"
          ? Prisma.sql`ASC`
          : Prisma.sql`DESC`;

      if (sortBy === "name") return Prisma.sql`p."name" ${dir}`;
      if (sortBy === "plays") return Prisma.sql`"plays" ${dir}, p."name" ASC`;
      if (sortBy === "devices")
        return Prisma.sql`"devices" ${dir}, p."name" ASC`;
      if (sortBy === "totalRunTime")
        return Prisma.sql`"totalRunTimeSec" ${dir}, p."name" ASC`;

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


export const getFolderPlayerStats = async (
  request: FastifyRequest<{
    Params: { folderId: number };
    Querystring: {
      startDate?: string;
      endDate?: string;
      offset?: number;
      limit?: number;
      search?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    };
  }>,
  reply: FastifyReply,
) => {
  try {
    const folderId = Number(request?.params?.folderId);
    if (!Number.isFinite(folderId))
      return reply.status(400).send({ message: "Invalid folderId" });

    const q = request.query ?? {};

    const range = parseRange(q.startDate, q.endDate);
    if (!range) return reply.status(400).send({ message: "Invalid date range" });

    const offset = Math.max(0, Number(q.offset ?? 0));
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 20)));

    const searchTerm =
      typeof q.search === "string" && q.search.trim().length > 0
        ? q.search.trim().toLowerCase()
        : null;

    const logs = await prisma.playLog.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        playerId: { not: null },
        file: {
          isDeleted: false,
          folderId,
          folder: { isDeleted: false },
        },
      },
      select: {
        playerId: true,
        createdAt: true,
        player: { select: { id: true, name: true } },
        playlistFile: { select: { duration: true } },
      },
    });

    const map = new Map<
      number,
      {
        playerId: number;
        playerName: string;
        plays: number;
        totalRunTimeSec: number;
      }
    >();

    for (const l of logs) {
      const pid = l.playerId;
      if (!pid || !l.player) continue;

      if (!map.has(pid)) {
        map.set(pid, {
          playerId: l.player.id,
          playerName: l.player.name,
          plays: 0,
          totalRunTimeSec: 0,
        });
      }

      const item = map.get(pid)!;
      item.plays += 1;
      item.totalRunTimeSec += l.playlistFile?.duration ?? 0;
    }

    let mapped = Array.from(map.values()).map((m) => ({
      playerId: m.playerId,
      playerName: m.playerName,
      plays: m.plays,
      totalHours: m.totalRunTimeSec,
    }));

    if (searchTerm) {
      mapped = mapped.filter((m) => m.playerName.toLowerCase().includes(searchTerm));
    }

    const playerIds = mapped.map((m) => m.playerId);

    const sessions = playerIds.length
      ? await prisma.playerSession.findMany({
          where: { playerId: { in: playerIds } },
          orderBy: [{ lastActiveAt: "desc" }],
          select: { playerId: true, lastActiveAt: true, isActive: true, endedAt: true },
        })
      : [];

    const latestSessionByPlayerId = new Map<number, { lastActiveAt: Date; isActive: boolean; endedAt: Date | null }>();
    for (const s of sessions) {
      if (!latestSessionByPlayerId.has(s.playerId)) {
        latestSessionByPlayerId.set(s.playerId, {
          lastActiveAt: s.lastActiveAt,
          isActive: s.isActive,
          endedAt: s.endedAt ?? null,
        });
      }
    }

    const withSession = mapped.map((m) => {
      const ses = latestSessionByPlayerId.get(m.playerId);
      const lastActive = ses?.lastActiveAt ?? null;
      const online = lastActive ? isOnline(lastActive, Boolean(ses?.isActive && !ses?.endedAt)) : false;

      return {
        playerId: m.playerId,
        playerName: m.playerName,
        lastActive,
        plays: m.plays,
        totalHours: m.totalHours,
        status: online ? "online" : "offline",
      };
    });

    const sortBy = q.sortBy ?? "lastActive";
    const dir = q.sortOrder === "asc" ? 1 : -1;

    withSession.sort((a: any, b: any) => {
      if (sortBy === "name") return a.playerName.localeCompare(b.playerName) * dir;
      if (sortBy === "plays") return (a.plays - b.plays) * dir;
      if (sortBy === "totalHours") return (a.totalHours - b.totalHours) * dir;
      if (sortBy === "status") return a.status.localeCompare(b.status) * dir;

      const at = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const bt = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return (at - bt) * dir;
    });

    const total = withSession.length;
    const paginated = withSession.slice(offset, offset + limit);

    return reply.send({
      message: "Folder player stats fetched",
      items: paginated,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
      meta: {
        totalPlayers: total,
        date: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getPlayerLogs = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const q = (req.query ?? {}) as any;

    const parseRangeLocal = (startDate?: string, endDate?: string) => {
      const isValid = (v?: string) => v && /^\d{4}-\d{2}-\d{2}$/.test(v);

      let start: Date;
      let end: Date;

      if (isValid(startDate) && isValid(endDate)) {
        const [sy, sm, sd] = startDate!.split("-").map(Number);
        const [ey, em, ed] = endDate!.split("-").map(Number);

        start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        end = new Date(ey, em - 1, ed + 1, 0, 0, 0, 0);
      } else {
        const now = new Date();

        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0,
        );

        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          0,
          0,
          0,
          0,
        );
      }

      return { start, end };
    };

    const range = parseRangeLocal(q?.startDate, q?.endDate);

    const sessions = await prisma.playerSession.findMany({
      where: {
        startedAt: {
          gte: range.start,
          lt: range?.end,
        },
      },
      include: {
        player: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    const now = new Date();

    const map = new Map<
      number,
      {
        id: number;
        name: string;
        lastSessionStart: Date | null;
        lastSessionEnd: Date | null;
        lastActive: Date | null;
        totalRunTimeSec: number;
        online: boolean;
      }
    >();

    for (const s of sessions) {
      if (!s.player) continue;

      const endPoint =
        s.endedAt ?? (s.isActive ? now : s.lastActiveAt ?? null);

      const durationSec =
        s.startedAt && endPoint
          ? Math.max(
              0,
              Math.floor(
                (endPoint.getTime() - s.startedAt.getTime()) / 1000,
              ),
            )
          : 0;

      const online = isOnline(
        s.lastActiveAt,
        Boolean(s.isActive && !s.endedAt),
      );

      if (!map.has(s.player.id)) {
        map.set(s.player.id, {
          id: s.player.id,
          name: s.player.name,
          lastSessionStart: s.startedAt ?? null,
          lastSessionEnd: s.endedAt ?? null,
          lastActive: s.lastActiveAt ?? null,
          totalRunTimeSec: durationSec,
          online,
        });
      } else {
        const item = map.get(s.player.id)!;

        item.totalRunTimeSec += durationSec;

        if (
          s.lastActiveAt &&
          (!item.lastActive || s.lastActiveAt > item.lastActive)
        ) {
          item.lastActive = s.lastActiveAt;
        }

        if (
          s.startedAt &&
          (!item.lastSessionStart ||
            s.startedAt > item.lastSessionStart)
        ) {
          item.lastSessionStart = s.startedAt;
          item.lastSessionEnd = s.endedAt ?? null;
        }

        if (online) item.online = true;
      }
    }

    const items = Array.from(map.values()).map((p) => ({
      id: p.id,
      name: p.name,
      sessionStart: p.lastSessionStart,
      sessionEnd: p.lastSessionEnd,
      status: p.online ? "Online" : "Offline",
      lastActive: p.lastActive,
      totalRunTimeSec: p.totalRunTimeSec,
    }));

    return reply.status(200).send({
      message: "Player logs fetched",
      items,
    });
  } catch (e: any) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getPlayerSessions = async (
  req: FastifyRequest<{
    Params: { playerId: number };
    Querystring: {
      startDate?: string;
      endDate?: string;
    };
  }>,
  reply: FastifyReply,
) => {
  try {
    const playerId = Number(req.params?.playerId);
    if (!Number.isFinite(playerId)) {
      return reply.status(400).send({ message: "Invalid playerId" });
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true,name: true },
    });
    if (!player) return reply.status(404).send({ message: "Player not found" });

    const q = req.query ?? {};

    const range = parseRange(q?.startDate, q?.endDate);
    console.log(range, q?.startDate, q?.endDate);
    if (!range) {
      return reply.status(400).send({ message: "Invalid date range" });
    }

    const sessions = await prisma.playerSession.findMany({
      where: {
        playerId,
        startedAt: {
          gte: range.start,
          lt: range.end,
        },
      },
      orderBy: { startedAt: "desc" },
    });

    const now = new Date();

    const items = sessions.map((s) => {
      let duration = 0;

      if (s.startedAt) {
        if (s.isActive && !s.endedAt) {
          duration = Math.floor(
            (now.getTime() - s.startedAt.getTime()) / 1000,
          );
        } else if (s.endedAt) {
          duration = Math.floor(
            (s.endedAt.getTime() - s.startedAt.getTime()) / 1000,
          );
        }
      }

      return {
        sessionStart: s.startedAt ?? null,
        sessionEnd: s.endedAt ?? null,
        status: s.isActive ? "Online" : "Offline",
        lastActive: s.lastActiveAt ?? null,
        totalRunTimeSec: Math.max(0, duration),
      };
    });

    return reply.status(200).send({
      message: "Player sessions fetched",
      player,
      items,
      meta: {
        date: {
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
      },
    });
  } catch (e) {
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};