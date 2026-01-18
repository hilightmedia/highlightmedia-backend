import { FastifyReply, FastifyRequest } from "fastify";
import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import { generateSignedUrl } from "../services/file";
import {
  BulkAddFileItem,
  BulkAddSubPlaylistItem,
  DurationBucket,
  SizeBucket,
  SortByPlaylist,
  SortOrder,
} from "../types/types";
import { compare, parseDateMaybe, toTopLevelType } from "../utils/common";

export const getPlayList = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const {
      sortBy = "lastModified",
      sortOrder = "desc",
      search,
      lastModifiedFrom,
      lastModifiedTo,
      durationBucket,
      durationFrom,
      durationTo,
    } = (req.query as any) ?? {};

    const parsedSortBy: SortByPlaylist = sortBy;
    const parsedSortOrder: "asc" | "desc" = sortOrder;

    const searchTerm =
      typeof search === "string" && search.trim().length > 0 ? search.trim() : null;

    const fromDate = parseDateMaybe(lastModifiedFrom);
    const toDate = parseDateMaybe(lastModifiedTo);

    const db: DurationBucket | undefined = durationBucket;

    const durFrom = durationFrom !== undefined && durationFrom !== null ? Number(durationFrom) : null;
    const durTo = durationTo !== undefined && durationTo !== null ? Number(durationTo) : null;

    const playlists = await prisma.playlist.findMany({
      where: searchTerm
        ? { name: { contains: searchTerm, mode: "insensitive" as const } }
        : undefined,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        playlistFiles: {
          where: { OR: [{ fileId: { not: null } }, { subPlaylistId: { not: null } }] },
          orderBy: { playOrder: "asc" },
          select: {
            id: true,
            duration: true,
            updatedAt: true,
            subPlaylistId: true,
            file: {
              select: {
                fileType: true,
                fileKey: true,
                fileSize: true,
                updatedAt: true,
                isDeleted: true,
              },
            },
          },
        },
      },
    });

    const allSubPlaylistIds = Array.from(
      new Set(
        playlists
          .flatMap((p) => p.playlistFiles.map((pf) => pf.subPlaylistId))
          .filter((x): x is number => typeof x === "number")
      )
    );

    const subPlaylistBytes = new Map<number, number>();

    if (allSubPlaylistIds.length > 0) {
      const subs = await prisma.playlist.findMany({
        where: { id: { in: allSubPlaylistIds } },
        select: {
          id: true,
          playlistFiles: {
            where: { fileId: { not: null } },
            select: { file: { select: { fileSize: true, isDeleted: true } } },
          },
        },
      });

      for (const sp of subs as any[]) {
        let bytes = 0;
        for (const pf of sp.playlistFiles) {
          if (!pf.file?.isDeleted) bytes += Number(pf.file?.fileSize ?? 0) || 0;
        }
        subPlaylistBytes.set(sp.id, bytes);
      }
    }

    let cards = await Promise.all(
      playlists.map(async (p) => {
        let durationSec = 0;
        let lastModifiedMs = p.updatedAt.getTime();
        let thumbnail: string | null = null;
        let totalBytes = 0;

        const visibleItems = p.playlistFiles.filter((it: any) => !it.file?.isDeleted);

        for (const item of visibleItems as any[]) {
          const d = Number(item.duration ?? 0);
          if (Number.isFinite(d) && d > 0) durationSec += d;

          lastModifiedMs = Math.max(lastModifiedMs, item.updatedAt.getTime());

          const f = item.file;
          if (f?.updatedAt) lastModifiedMs = Math.max(lastModifiedMs, f.updatedAt.getTime());

          if (f?.fileSize) totalBytes += Number(f.fileSize) || 0;

          if (item.subPlaylistId) {
            totalBytes += subPlaylistBytes.get(item.subPlaylistId) ?? 0;
          }

          if (!thumbnail && f?.fileType?.split("/")[0] === "image" && f?.fileKey) {
            thumbnail = await generateSignedUrl(f.fileKey);
          }
        }

        const playlistSizeMb = Number((totalBytes / (1024 * 1024)).toFixed(2));

        return {
          id: p.id,
          name: p.name,
          thumbnail: thumbnail ?? "",
          totalItems: p.playlistFiles.length,
          durationSec,
          playlistSize: playlistSizeMb,
          lastModified: new Date(lastModifiedMs),
        };
      })
    );

    if (fromDate) cards = cards.filter((x) => x.lastModified.getTime() >= fromDate.getTime());
    if (toDate) cards = cards.filter((x) => x.lastModified.getTime() <= toDate.getTime());

    if (db) {
      cards = cards.filter((x) => {
        const sec = Number(x.durationSec ?? 0) || 0;
        if (db === "0-3") return sec >= 0 && sec <= 180;
        if (db === "5-10") return sec >= 300 && sec <= 600;
        if (db === "10+") return sec >= 600;
        return true;
      });
    }

    if (durFrom !== null && Number.isFinite(durFrom)) {
      cards = cards.filter((x) => (Number(x.durationSec ?? 0) || 0) >= durFrom);
    }
    if (durTo !== null && Number.isFinite(durTo)) {
      cards = cards.filter((x) => (Number(x.durationSec ?? 0) || 0) <= durTo);
    }

    cards.sort((a, b) => {
      switch (parsedSortBy) {
        case "name":
          return compare(a.name.toLowerCase(), b.name.toLowerCase(), parsedSortOrder);
        case "items":
          return compare(a.totalItems, b.totalItems, parsedSortOrder);
        case "lastModified":
          return compare(a.lastModified.getTime(), b.lastModified.getTime(), parsedSortOrder);
        case "duration":
          return compare(a.durationSec, b.durationSec, parsedSortOrder);
        default:
          return 0;
      }
    });

    return reply.status(200).send({
      message: "Playlist fetched successfully",
      playlists: cards,
      meta: {
        sortBy: parsedSortBy,
        sortOrder: parsedSortOrder,
        search: searchTerm,
        filters: {
          lastModifiedFrom: fromDate?.toISOString() ?? null,
          lastModifiedTo: toDate?.toISOString() ?? null,
          durationBucket: db ?? null,
          durationFrom: durFrom,
          durationTo: durTo,
        },
      },
    });
  } catch (e) {
    console.log("Get playlist error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getPlaylistById = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { playlistId } = req.params as { playlistId: number };
    const id = Number(playlistId);

    if (!Number.isFinite(id)) {
      return reply.status(400).send({ message: "Invalid playlistId" });
    }

    const {
      sortBy = "playOrder",
      sortOrder = "asc",
      sizeBucket,
      type,
      lastModifiedFrom,
      lastModifiedTo,
      durationBucket,
      search,
    } = (req.query as any) ?? {};

    const parsedSortOrder: SortOrder = sortOrder as SortOrder;

    const fromDate = parseDateMaybe(lastModifiedFrom);
    const toDate = parseDateMaybe(lastModifiedTo);

    const searchTerm =
      typeof search === "string" && search.trim().length > 0 ? search.trim() : null;

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        playlistFiles: {
          where: {
            OR: [{ fileId: { not: null } }, { subPlaylistId: { not: null } }],
          },
          orderBy: { playOrder: "asc" },
          select: {
            id: true,
            duration: true,
            updatedAt: true,
            fileId: true,
            subPlaylistId: true,
            isSubPlaylist: true,
            playOrder: true,
            file: {
              select: {
                id: true,
                name: true,
                fileKey: true,
                fileType: true,
                fileSize: true,
                updatedAt: true,
                isDeleted: true,
              },
            },
            subPlaylist: {
              select: {
                id: true,
                name: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!playlist) return reply.status(404).send({ message: "Playlist not found" });

    const subIds = Array.from(
      new Set(
        playlist.playlistFiles
          .map((pf: any) => pf.subPlaylistId)
          .filter((x: any): x is number => typeof x === "number")
      )
    );

    const subAgg = new Map<number, { fileIds: number[]; length: number; sizeBytes: number }>();

    if (subIds.length > 0) {
      const subs = await prisma.playlist.findMany({
        where: { id: { in: subIds } },
        select: {
          id: true,
          playlistFiles: {
            where: { OR: [{ fileId: { not: null } }, { subPlaylistId: { not: null } }] },
            select: {
              fileId: true,
              file: { select: { fileSize: true, isDeleted: true } },
            },
          },
        },
      });

      for (const sp of subs as any[]) {
        const fileIds: number[] = [];
        let sizeBytes = 0;
        let length = 0;

        for (const it of sp.playlistFiles) {
          if (typeof it.fileId === "number") fileIds.push(it.fileId);
          if (!it.file?.isDeleted) {
            sizeBytes += Number(it.file?.fileSize ?? 0) || 0;
            length += 1;
          }
        }

        subAgg.set(sp.id, { fileIds, length, sizeBytes });
      }
    }

    const directFileIds = playlist.playlistFiles
      .map((pf: any) => pf.fileId)
      .filter((x: any): x is number => typeof x === "number");

    const allFileIds = Array.from(
      new Set([...directFileIds, ...Array.from(subAgg.values()).flatMap((x: any) => x.fileIds)])
    );

    const fileLogCount = new Map<number, number>();
    if (allFileIds.length > 0) {
      const grouped = await prisma.playLog.groupBy({
        by: ["fileId"],
        where: { fileId: { in: allFileIds } },
        _count: { _all: true },
      });

      for (const g of grouped) fileLogCount.set(g.fileId, g._count._all);
    }

    const itemsRaw = await Promise.all(
      playlist.playlistFiles.map(async (pf: any) => {
        const durationSec = Number(pf.duration ?? 0) || 0;

        if (pf.fileId && pf.file && !pf.file.isDeleted) {
          const url = await generateSignedUrl(pf.file.fileKey);
          const sizeBytes = Number(pf.file.fileSize ?? 0) || 0;
          const sizeMb = Number((sizeBytes / (1024 * 1024)).toFixed(2));
          const logsCount = fileLogCount.get(pf.fileId) ?? 0;

          const lastModifiedMs = Math.max(pf.updatedAt.getTime(), pf.file.updatedAt.getTime());

          return {
            playlistFileId: pf.id,
            fileId: pf.fileId,
            subPlaylistId: null,
            name: pf.file.name,
            url,
            type: pf.file.fileType,
            duration: durationSec,
            playOrder: pf.playOrder,
            size: sizeMb,
            logsCount,
            lastModified: new Date(lastModifiedMs),
          };
        }

        if (pf.subPlaylistId && pf.subPlaylist) {
          const agg = subAgg.get(pf.subPlaylistId) ?? { fileIds: [], length: 0, sizeBytes: 0 };
          const sizeMb = Number((agg.sizeBytes / (1024 * 1024)).toFixed(2));

          const totalSubLogs = agg.fileIds.reduce(
            (sum, fid) => sum + (fileLogCount.get(fid) ?? 0),
            0
          );

          const denom = Math.max(agg.length, 1);
          const logsCount = Math.ceil(totalSubLogs / denom);

          const lastModifiedMs = Math.max(pf.updatedAt.getTime(), pf.subPlaylist.updatedAt.getTime());

          return {
            playlistFileId: pf.id,
            fileId: null,
            subPlaylistId: pf.subPlaylistId,
            name: pf.subPlaylist.name,
            playOrder: pf.playOrder,
            url: null,
            type: "subPlaylist",
            duration: durationSec,
            size: sizeMb,
            logsCount,
            lastModified: new Date(lastModifiedMs),
          };
        }

        return null;
      })
    );

    let result = itemsRaw.filter(Boolean) as any[];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter((x: any) => String(x.name ?? "").toLowerCase().includes(s));
    }

    const sb: SizeBucket | undefined = sizeBucket;
    if (sb) {
      result = result.filter((x: any) => {
        if (sb === "0-10") return x.size >= 0 && x.size < 10;
        if (sb === "10-100") return x.size >= 10 && x.size < 100;
        if (sb === "100+") return x.size >= 100;
        return true;
      });
    }

    if (typeof type === "string" && type.trim()) {
      const t = type.trim().toLowerCase();
      result = result.filter((x: any) => {
        const xt = String(x.type ?? "").toLowerCase();
        if (t === "subplaylist") return xt === "subplaylist";
        if (t.includes("/")) return xt === t;
        return toTopLevelType(xt) === t;
      });
    }

    if (fromDate) result = result.filter((x: any) => x.lastModified.getTime() >= fromDate.getTime());
    if (toDate) result = result.filter((x: any) => x.lastModified.getTime() <= toDate.getTime());

    const db: DurationBucket | undefined = durationBucket;
    if (db) {
      result = result.filter((x: any) => {
        const sec = Number(x.duration ?? 0) || 0;
        if (db === "0-3") return sec >= 0 && sec <= 180;
        if (db === "5-10") return sec >= 300 && sec <= 600;
        if (db === "10+") return sec >= 600;
        return true;
      });
    }

    result.sort((a: any, b: any) => {
      switch (String(sortBy)) {
        case "playOrder":
          return compare(a.playOrder, b.playOrder, parsedSortOrder);
        case "name":
          return compare(a.name.toLowerCase(), b.name.toLowerCase(), parsedSortOrder);
        case "type":
          return compare(String(a.type).toLowerCase(), String(b.type).toLowerCase(), parsedSortOrder);
        case "lastModified":
          return compare(a.lastModified.getTime(), b.lastModified.getTime(), parsedSortOrder);
        case "size":
          return compare(a.size, b.size, parsedSortOrder);
        case "duration":
          return compare(a.duration, b.duration, parsedSortOrder);
        default:
          return compare(a.playOrder, b.playOrder, "asc");
      }
    });

    return reply.status(200).send({
      message: "Playlist fetched successfully",
      playlist: {
        id: playlist.id,
        name: playlist.name,
        updatedAt: playlist.updatedAt,
        items: result,
      },
      meta: {
        sortBy,
        sortOrder: parsedSortOrder,
        search: searchTerm,
        filters: {
          sizeBucket: sb ?? null,
          type: typeof type === "string" ? type : null,
          lastModifiedFrom: fromDate?.toISOString() ?? null,
          lastModifiedTo: toDate?.toISOString() ?? null,
          durationBucket: db ?? null,
        },
      },
    });
  } catch (e) {
    console.log("Get playlist by id error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};


export const getPlaylistOnly = async (req: FastifyRequest, reply: FastifyReply) => {
  try{
   const playlist = await prisma.playlist.findMany({
    select:{
      id: true,
      name: true,
    }
   })

   return reply.status(200).send({message: "Playlist fetched successfully", playlist});
  }
  catch(e){
    console.log("Get playlist only error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}

export const createPlaylist = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { name,duration = 30 } = req.body as { name: string, duration?: number };

    const playlist = await prisma.playlist.create({
      data: { name, defaultDuration: duration },
    });

    return reply
      .status(200)
      .send({ message: "Playlist created successfully", playlist });
  } catch (e) {
    console.log("Create playlist error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const editPlaylist = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { playlistId } = req.params as { playlistId: number };
    const { name, duration } = req.body as { name: string; duration?: number };

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true, defaultDuration: true },
    });
    if (!playlist) return reply.status(404).send({ message: "Playlist not found" });

    if (playlist.defaultDuration != duration) {
      await prisma.playlistFile.updateMany({
        where: {
          playlistId,
          duration: { not: duration },
          OR: [
            { fileId: null },
            { file: { fileType: { not: { startsWith: "video/" } } } },
          ],
        },
        data: { duration },
      });

      const updated = await prisma.playlist.update({
        where: { id: playlistId },
        data: { name, defaultDuration: duration },
      });

      return reply
        .status(200)
        .send({ message: "Playlist updated successfully", playlist: updated });
    }

    const updated = await prisma.playlist.update({
      where: { id: playlistId },
      data: { name },
    });

    return reply
      .status(200)
      .send({ message: "Playlist updated successfully", playlist: updated });
  } catch (e) {
    console.log("Edit playlist error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const addToPlaylist = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { playlistId, fileId, duration } = req.body as {
      playlistId: number;
      fileId: number;
      duration: number; // seconds
    };

    const dur = Number(duration);
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true },
    });
    if (!playlist)
      return reply.status(404).send({ message: "Playlist not found" });

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true, fileType: true },
    });
    if (!file) return reply.status(404).send({ message: "File not found" });

    const last = await prisma.playlistFile.findFirst({
      where: { playlistId },
      orderBy: { playOrder: "desc" },
      select: { playOrder: true },
    });

    const nextPlayOrder = (last?.playOrder ?? 0) + 1;

    await prisma.playlistFile.create({
      data: {
        playlistId,
        fileId,
        isSubPlaylist: false,
        playOrder: nextPlayOrder,
        duration: Math.floor(dur),
      },
    });

    return reply
      .status(200)
      .send({ message: "File added to playlist successfully" });
  } catch (e) {
    console.log("Add to playlist error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const addSubPlaylist = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { playlistId, subPlaylistId } = req.body as {
      playlistId: number;
      subPlaylistId: number;
    };

    if (!Number.isFinite(playlistId) || !Number.isFinite(subPlaylistId)) {
      return reply
        .status(400)
        .send({ message: "Invalid playlistId or subPlaylistId" });
    }

    if (playlistId === subPlaylistId) {
      return reply
        .status(400)
        .send({ message: "A playlist cannot include itself." });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true },
    });
    if (!playlist)
      return reply.status(404).send({ message: "Playlist not found" });

    const subPlaylist = await prisma.playlist.findUnique({
      where: { id: subPlaylistId },
      select: { id: true },
    });
    if (!subPlaylist)
      return reply.status(404).send({ message: "Sub playlist not found" });

    const subItems = await prisma.playlistFile.findMany({
      where: { playlistId: subPlaylistId },
      select: { duration: true },
    });

    const subPlaylistDuration = subItems.reduce((sum, x) => {
      const d = Number(x.duration ?? 0);
      return sum + (Number.isFinite(d) && d > 0 ? d : 0);
    }, 0);

    // playOrder
    const last = await prisma.playlistFile.findFirst({
      where: { playlistId },
      orderBy: { playOrder: "desc" },
      select: { playOrder: true },
    });

    const nextPlayOrder = (last?.playOrder ?? 0) + 1;

     await prisma.playlistFile.create({
      data: {
        playlistId,
        subPlaylistId,
        isSubPlaylist: true,
        playOrder: nextPlayOrder,
        duration: subPlaylistDuration, // ✅ required
      },
    });

    return reply.status(200).send({
      message: "Sub playlist added to playlist successfully",
    });
  } catch (e) {
    console.log("Add sub playlist error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const movePlaylistFile = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { playlistFileId, playOrder: newOrder } = req.body as {
      playlistFileId: number;
      playOrder: number;
    };

    const item = await prisma.playlistFile.findUnique({
      where: { id: playlistFileId },
      select: { id: true, playlistId: true, playOrder: true },
    });

    if (!item) return reply.status(404).send({ message: "Item not found" });

    if (newOrder < 1) {
      return reply.status(400).send({ message: "playOrder must be >= 1" });
    }

    const playlistId = item.playlistId;
    const oldOrder = item.playOrder;

    if (oldOrder === newOrder) {
      return reply
        .status(200)
        .send({ message: "Item already at that position" });
    }

    await prisma.$transaction(async (tx) => {
      if (newOrder > oldOrder) {
        // Moving down: shift up items in (oldOrder, newOrder]
        await tx.playlistFile.updateMany({
          where: {
            playlistId,
            playOrder: { gt: oldOrder, lte: newOrder },
          },
          data: { playOrder: { decrement: 1 } },
        });
      } else {
        await tx.playlistFile.updateMany({
          where: {
            playlistId,
            playOrder: { gte: newOrder, lt: oldOrder },
          },
          data: { playOrder: { increment: 1 } },
        });
      }

      await tx.playlistFile.update({
        where: { id: playlistFileId },
        data: { playOrder: newOrder },
      });
    });

    return reply.status(200).send({ message: "Item moved successfully" });
  } catch (e) {
    console.log("Move playlist file error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const deletePlaylistFile = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { playlistFileId } = req.params as { playlistFileId: number };
    const id = Number(playlistFileId);

    if (!Number.isFinite(id)) {
      return reply.status(400).send({ message: "Invalid playlistFileId" });
    }

    const item = await prisma.playlistFile.findUnique({
      where: { id },
      select: { id: true, playlistId: true, playOrder: true },
    });

    if (!item)
      return reply.status(404).send({ message: "Playlist item not found" });

    await prisma.$transaction(async (tx) => {
      // delete item
      await tx.playlistFile.delete({ where: { id } });

      // compact playOrder for items after the deleted one (same playlist only)
      await tx.playlistFile.updateMany({
        where: {
          playlistId: item.playlistId,
          playOrder: { gt: item.playOrder },
        },
        data: { playOrder: { decrement: 1 } },
      });
    });

    return reply.status(200).send({
      message: "Playlist item deleted successfully",
      deleted: { playlistFileId: item.id, playlistId: item.playlistId },
    });
  } catch (e) {
    console.log("Delete playlist file error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const deletePlaylist = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { playlistId } = req.params as { playlistId: number };
    const id = Number(playlistId);

    if (!Number.isFinite(id)) {
      return reply.status(400).send({ message: "Invalid playlistId" });
    }

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!playlist)
      return reply.status(404).send({ message: "Playlist not found" });

    await prisma.playlist.delete({ where: { id } });

    return reply.status(200).send({
      message: "Playlist deleted successfully",
      deleted: playlist,
    });
  } catch (e) {
    console.log("Delete playlist error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const bulkAddSubPlaylistsToPlaylist = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { playlistId, items } = req.body as { playlistId: number; items: BulkAddSubPlaylistItem[] };

    const pid = Number(playlistId);
    if (!Number.isFinite(pid)) return reply.status(400).send({ message: "Invalid playlistId" });

    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ message: "items is required" });
    }

    const normalized = items
      .map((x) => ({
        subPlaylistId: Number(x.subPlaylistId),
        duration: Math.floor(Number(x.duration)),
      }))
      .filter(
        (x) =>
          Number.isFinite(x.subPlaylistId) &&
          Number.isFinite(x.duration) &&
          x.duration > 0 &&
          x.subPlaylistId !== pid
      );

    if (normalized.length === 0) return reply.status(400).send({ message: "No valid items" });

    const playlist = await prisma.playlist.findUnique({ where: { id: pid }, select: { id: true } });
    if (!playlist) return reply.status(404).send({ message: "Playlist not found" });

    const subIds = Array.from(new Set(normalized.map((x) => x.subPlaylistId)));

    const subs = await prisma.playlist.findMany({
      where: { id: { in: subIds } },
      select: { id: true },
    });
    const validSubIdSet = new Set(subs.map((s) => s.id));

    const validItems = normalized.filter((x) => validSubIdSet.has(x.subPlaylistId));
    if (validItems.length === 0)
      return reply.status(404).send({ message: "No valid subPlaylists found" });

    const maxOrder = await prisma.playlistFile.aggregate({
      where: { playlistId: pid },
      _max: { playOrder: true },
    });

    let nextOrder = (maxOrder._max.playOrder ?? 0) + 1;

    const data = validItems.map((it) => ({
      playlistId: pid,
      isSubPlaylist: true,
      fileId: null,
      subPlaylistId: it.subPlaylistId,
      duration: it.duration,
      playOrder: nextOrder++,
    }));

    const created = await prisma.playlistFile.createMany({ data });

    return reply.status(200).send({
      message: "SubPlaylists added to playlist successfully",
      createdCount: created.count,
      invalidCount: normalized.length - validItems.length,
    });
  } catch (e) {
    console.log("bulkAddSubPlaylistsToPlaylist error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const bulkAddFilesToPlaylist = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { playlistId, items } = req.body as { playlistId: number; items: BulkAddFileItem[] };

    const pid = Number(playlistId);
    if (!Number.isFinite(pid)) return reply.status(400).send({ message: "Invalid playlistId" });

    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ message: "items is required" });
    }

    const normalized = items
      .map((x) => ({ fileId: Number(x.fileId), duration: Math.floor(Number(x.duration)) }))
      .filter((x) => Number.isFinite(x.fileId) && Number.isFinite(x.duration) && x.duration > 0);

    if (normalized.length === 0) return reply.status(400).send({ message: "No valid items" });

    const playlist = await prisma.playlist.findUnique({ where: { id: pid }, select: { id: true } });
    if (!playlist) return reply.status(404).send({ message: "Playlist not found" });

    const fileIds = Array.from(new Set(normalized.map((x) => x.fileId)));

    const files = await prisma.file.findMany({
      where: { id: { in: fileIds }, isDeleted: false },
      select: { id: true },
    });
    const validFileIdSet = new Set(files.map((f) => f.id));

    const validItems = normalized.filter((x) => validFileIdSet.has(x.fileId));
    if (validItems.length === 0) return reply.status(404).send({ message: "No valid files found" });

    const maxOrder = await prisma.playlistFile.aggregate({
      where: { playlistId: pid },
      _max: { playOrder: true },
    });

    let nextOrder = (maxOrder._max.playOrder ?? 0) + 1;

    const data = validItems.map((it) => ({
      playlistId: pid,
      isSubPlaylist: false,
      fileId: it.fileId,
      subPlaylistId: null,
      duration: it.duration,
      playOrder: nextOrder++,
    }));

    const created = await prisma.playlistFile.createMany({ data });

    return reply.status(200).send({
      message: "Files added to playlist successfully",
      createdCount: created.count,
      invalidCount: normalized.length - validItems.length,
    });
  } catch (e) {
    console.log("bulkAddFilesToPlaylist error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};