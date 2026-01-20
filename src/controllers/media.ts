import toHttpError from "../utils/toHttpError";
import { prisma } from "../db/client";
import { FastifyReply, FastifyRequest } from "fastify";
import { generateSignedUrl, handleUpload } from "../services/file";
import {
  MediaStatus,
  SizeBucket,
  SortBy,
  SortByFile,
  SortOrder,
  StatusFilter,
} from "../types/types";
import { ALLOWED_MIME } from "../utils/file";
import { parseDateMaybe, compare, toTopLevelType } from "../utils/common";

export async function getClientFolders(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const {
      sortBy = "lastModified",
      sortOrder = "desc",
      lastModifiedFrom,
      lastModifiedTo,
      sizeBucket,
      status,
      search,
    } = (req.query as any) ?? {};

    const parsedSortBy: SortBy = sortBy as SortBy;
    const parsedSortOrder: SortOrder = sortOrder as SortOrder;

    const fromDate = parseDateMaybe(lastModifiedFrom);
    const toDate = parseDateMaybe(lastModifiedTo);

    const searchTerm =
      typeof search === "string" && search.trim().length > 0
        ? search.trim()
        : null;

    const folders = await prisma.folder.findMany({
      where: {
        verified: true,
        isDeleted: false,
        ...(searchTerm
          ? { name: { contains: searchTerm, mode: "insensitive" as const } }
          : {}),
      },
      include: {
        files: {
          where: { isDeleted: false },
          select: {
            id: true,
            fileKey: true,
            fileType: true,
            fileSize: true,
            duration: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const folderFileIds = new Map<number, number[]>();
    const allFileIds: number[] = [];

    for (const f of folders as any[]) {
      const ids = (f.files ?? [])
        .map((x: any) => x.id)
        .filter((x: any) => Number.isFinite(x));
      folderFileIds.set(f.id, ids);
      allFileIds.push(...ids);
    }

    const activeFolderIds = new Set<number>();

    if (allFileIds.length > 0) {
      const usedFiles = await prisma.playlistFile.findMany({
        where: {
          fileId: { in: Array.from(new Set(allFileIds)) },
          playlist: {
            players: { some: { linked: true } },
          },
        },
        select: { fileId: true },
      });

      const usedFileIdSet = new Set<number>(
        usedFiles
          .map((u) => u.fileId)
          .filter((x): x is number => typeof x === "number"),
      );

      for (const [folderId, ids] of folderFileIds.entries()) {
        if (ids.some((id) => usedFileIdSet.has(id)))
          activeFolderIds.add(folderId);
      }
    }

    const now = new Date();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const computed = await Promise.all(
      (folders as any[]).map(async (folder: any) => {
        const folderSizeBytes = (folder.files ?? []).reduce(
          (sum: number, f: any) => {
            const bytes = Number(f.fileSize ?? 0);
            return sum + (Number.isFinite(bytes) ? bytes : 0);
          },
          0,
        );

        const folderDuration = (folder.files ?? []).reduce(
          (sum: number, f: any) => {
            const d = Number(f.duration ?? 0);
            return sum + (Number.isFinite(d) ? d : 0);
          },
          0,
        );

        let lastModified: Date = folder.updatedAt;
        if (folder.files?.length) {
          for (const f of folder.files) {
            if (
              f?.updatedAt &&
              f.updatedAt.getTime() > lastModified.getTime()
            ) {
              lastModified = f.updatedAt;
            }
          }
        }

        let thumbnail = "";
        const firstImage = folder.files?.find(
          (f: any) => f?.fileType?.split("/")[0] === "image",
        );
        if (firstImage?.fileKey)
          thumbnail = await generateSignedUrl(firstImage.fileKey);

        let validityStatus: string = "running";
        let statusBucket: StatusFilter = "running";
        let validityStart: Date | null = folder.validityStart ?? null;
        let validityEnd: Date | null = folder.validityEnd ?? null;
        let validityPeriodMs: number | null = null;

        if (validityStart && validityEnd) {
          validityPeriodMs = Math.max(
            0,
            validityEnd.getTime() - validityStart.getTime(),
          );
          const timeToEndMs = validityEnd.getTime() - now.getTime();

          if (validityEnd < now) {
            validityStatus = "completed";
            statusBucket = "completed";
          } else if (timeToEndMs > SEVEN_DAYS_MS) {
            validityStatus = "running";
            statusBucket = "running";
          } else {
            const daysLeft = Math.ceil(timeToEndMs / (24 * 60 * 60 * 1000));
            validityStatus = `${daysLeft} days left`;
            statusBucket = "expiring";
          }
        } else {
          validityStatus = "running";
          statusBucket = "running";
        }

        const folderStatus = activeFolderIds.has(folder.id)
          ? "active"
          : "inactive";

        return {
          id: folder.id,
          name: folder.name,
          validityStart,
          validityEnd,
          verified: folder.verified,
          validityStatus,
          statusBucket,
          folderSize: folderSizeBytes,
          folderDuration,
          thumbnail,
          lastModified,
          validityPeriodMs,
          status: folderStatus,
        };
      }),
    );

    let result = computed;

    if (fromDate)
      result = result.filter(
        (x) => x.lastModified.getTime() >= fromDate.getTime(),
      );
    if (toDate)
      result = result.filter(
        (x) => x.lastModified.getTime() <= toDate.getTime(),
      );

    const sb: SizeBucket | undefined = sizeBucket as SizeBucket | undefined;
    if (sb) {
      result = result.filter((x) => {
        if (sb === "0-10") return x.folderSize >= 0 && x.folderSize < 10;
        if (sb === "10-100") return x.folderSize >= 10 && x.folderSize < 100;
        if (sb === "100+") return x.folderSize >= 100;
        return true;
      });
    }

    const st: StatusFilter | undefined = status as StatusFilter | undefined;
    if (st) result = result.filter((x) => x.statusBucket === st);

    result.sort((a, b) => {
      switch (parsedSortBy) {
        case "name":
          return compare(
            a.name.toLowerCase(),
            b.name.toLowerCase(),
            parsedSortOrder,
          );
        case "folderSize":
          return compare(a.folderSize, b.folderSize, parsedSortOrder);
        case "lastModified":
          return compare(
            a.lastModified.getTime(),
            b.lastModified.getTime(),
            parsedSortOrder,
          );
        case "validityPeriod": {
          const aVal = a.validityPeriodMs ?? Infinity;
          const bVal = b.validityPeriodMs ?? Infinity;
          return compare(aVal, bVal, parsedSortOrder);
        }
        case "validityDate": {
          const aTime = a.validityEnd?.getTime() ?? Infinity;
          const bTime = b.validityEnd?.getTime() ?? Infinity;
          return compare(aTime, bTime, parsedSortOrder);
        }
        default:
          return 0;
      }
    });

    const media = result.map(
      ({ statusBucket, validityPeriodMs, ...rest }) => rest,
    );

    return reply.status(200).send({
      message: "Folders fetched successfully",
      media,
      meta: {
        sortBy: parsedSortBy,
        sortOrder: parsedSortOrder,
        search: searchTerm,
        filters: {
          lastModifiedFrom: fromDate?.toISOString() ?? null,
          lastModifiedTo: toDate?.toISOString() ?? null,
          sizeBucket: sb ?? null,
          status: st ?? null,
        },
      },
    });
  } catch (e) {
    console.log("Get folders error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
}


export const createFolder = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const {
      name,
      start_date = new Date(),
      end_date,
    } = req.body as {
      name: string;
      start_date?: Date;
      end_date?: Date;
    };

    const findUnique = await prisma.folder.findFirst({
      where: { name, isDeleted: false },
      select: { id: true },
    });

    if (findUnique?.id)
      return reply.status(400).send({ message: "Folder name exists" });

    const folder = await prisma.folder.create({
      data: {
        name,
        validityStart: start_date ? new Date(start_date) : null,
        validityEnd: end_date ? new Date(end_date) : null,
        verified: true,
      },
    });

    return reply
      .status(200)
      .send({ message: "Folder created successfully", folder });
  } catch (e) {
    console.log("Create folder error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const editFolder = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { folderId } = req.body as { folderId: number };
    const folder_id = Number(folderId);
    if (!Number.isFinite(folder_id))
      return reply.status(400).send({ message: "Invalid folderId" });

    const folder = await prisma.folder.findFirst({
      where: { id: folder_id, isDeleted: false },
    });
    if (!folder) return reply.status(404).send({ message: "Folder not found" });

    const { name, start_date, end_date } = req.body as {
      name: string;
      start_date?: Date;
      end_date?: Date;
    };

    const findUnique = await prisma.folder.findFirst({
      where: { name, isDeleted: false },
      select: { id: true },
    });

    if (findUnique && findUnique.id !== folder_id)
      return reply.status(400).send({ message: "Folder name exists" });

    await prisma.folder.update({
      where: { id: folder_id },
      data: {
        name,
        validityStart: start_date ? new Date(start_date) : null,
        validityEnd: end_date ? new Date(end_date) : null,
      },
    });

    return reply.status(200).send({ message: "Folder updated successfully" });
  } catch (e) {
    console.log("Edit folder error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const deleteFolder = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { folderId } = req.body as { folderId: number };
    const folder_id = Number(folderId);
    if (!Number.isFinite(folder_id))
      return reply.status(400).send({ message: "Invalid folderId" });

    const folder = await prisma.folder.findFirst({
      where: { id: folder_id, isDeleted: false },
    });
    if (!folder) return reply.status(404).send({ message: "Folder not found" });

    const files = await prisma.file.findMany({
      where: { folderId: folder_id, isDeleted: false },
      select: { fileKey: true, id: true },
    });

    const now = new Date();
    const fileIds = files && files.length > 0 ? files.map((f) => f.id) : [];

    await prisma.$transaction(async (tx) => {
      if (fileIds.length > 0) {
        await tx.playlistFile.deleteMany({
          where: { fileId: { in: fileIds } },
        });
        await tx.file.updateMany({
          where: { id: { in: fileIds }, isDeleted: false },
          data: { deletedAt: now, isDeleted: true },
        });
      }

      await tx.folder.update({
        where: { id: folder_id },
        data: { deletedAt: now, isDeleted: true },
      });
    });

    return reply
      .status(200)
      .send({ message: "Folder and files deleted successfully" });
  } catch (e) {
    console.log("Delete folder error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const uploadMedia = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    if (!req.isMultipart()) {
      return reply
        .status(400)
        .send({ message: "Request must be multipart/form-data" });
    }

    const { folderId } = req.params as { folderId: number };
    const folder_id = Number(folderId);
    if (!Number.isFinite(folder_id)) {
      return reply.status(400).send({ message: "Invalid folderId" });
    }

    const folder = await prisma.folder.findFirst({
      where: { id: folder_id, isDeleted: false },
    });
    if (!folder) return reply.status(404).send({ message: "Folder not found" });

    const prefix = folder.name.replace(/[^a-zA-Z0-9]/g, "_");

    let filename: string | null = null;
    let mimetype: string | null = null;

    let sizeRaw: any = undefined;
    let durationRaw: any = undefined;
    let typeRaw: any = undefined;

    let uploadPromise: Promise<{ key: string; url: string }> | null = null;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (uploadPromise) {
          return reply.status(400).send({ message: "Only 1 file allowed" });
        }

        if (!ALLOWED_MIME.has(part.mimetype)) {
          return reply.status(400).send({
            message: `Invalid file type for "${part.filename}". Only image/video/pdf allowed`,
            mimetype: part.mimetype,
          });
        }

        filename = part.filename;
        mimetype = part.mimetype;

        uploadPromise = handleUpload({
          fileStream: part.file,
          originalname: part.filename,
          mimetype: part.mimetype,
          prefix,
        });

        continue;
      }

      if (part.type === "field") {
        if (part.fieldname === "size") sizeRaw = part.value;
        if (part.fieldname === "duration") durationRaw = part.value;
        if (part.fieldname === "type") typeRaw = part.value;
      }
    }

    if (!uploadPromise || !filename || !mimetype) {
      return reply.status(400).send({ message: "No file found" });
    }

    const duration =
      typeof durationRaw === "string" && durationRaw.trim() !== ""
        ? Number(durationRaw)
        : null;

    const fileSize =
      typeof sizeRaw === "string" && sizeRaw.trim() !== ""
        ? Number(sizeRaw)
        : null;

    if (duration !== null && (!Number.isFinite(duration) || duration < 0)) {
      return reply.status(400).send({ message: "Invalid duration" });
    }

    if (fileSize !== null && (!Number.isFinite(fileSize) || fileSize < 0)) {
      return reply.status(400).send({ message: "Invalid file size" });
    }

    if (typeof typeRaw === "string" && typeRaw.trim() !== "") {
      if (typeRaw !== mimetype) {
        return reply.status(400).send({ message: "Invalid type" });
      }
    }

    const result = await uploadPromise;

    const media = await prisma.file.create({
      data: {
        folder: { connect: { id: folder_id } },
        name: filename,
        verified: true,
        fileType: mimetype,
        fileKey: result.key,
        fileSize: String(fileSize ?? 0),
        duration: String(duration ?? 0),
      },
    });

    return reply.status(200).send({
      message: "Media uploaded successfully",
      media: { ...media, signedUrl: result.url },
      meta: {
        file: filename,
        size: fileSize,
        duration,
        type: mimetype,
      },
    });
  } catch (e) {
    console.log("Upload media error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getMedia = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { folderId } = req.params as { folderId: number };
    const folder_id = Number(folderId);
    if (!Number.isFinite(folder_id))
      return reply.status(400).send({ message: "Invalid folderId" });

    const folder = await prisma.folder.findFirst({
      where: { id: folder_id, isDeleted: false },
    });
    if (!folder) return reply.status(404).send({ message: "Folder not found" });

    const {
      sortBy = "createdAt",
      sortOrder = "desc",
      sizeBucket,
      fileType,
      status,
      from,
      to,
      search,
    } = (req.query as any) ?? {};

    const parsedSortBy: SortByFile = sortBy;
    const parsedSortOrder: SortOrder = sortOrder;

    const fromDate = parseDateMaybe(from);
    const toDate = parseDateMaybe(to);

    const searchTerm =
      typeof search === "string" && search.trim().length > 0
        ? search.trim()
        : null;

    const media = await prisma.file.findMany({
      where: {
        folderId: folder_id,
        isDeleted: false,
        ...(searchTerm
          ? { name: { contains: searchTerm, mode: "insensitive" as const } }
          : {}),
        ...(fromDate || toDate
          ? {
              updatedAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(fileType
          ? {
              OR: [
                {
                  fileType: {
                    equals: String(fileType),
                    mode: "insensitive" as const,
                  },
                },
                {
                  fileType: {
                    startsWith: `${String(fileType)}/`,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        fileKey: true,
        fileType: true,
        fileSize: true,
        duration: true,
        createdAt: true,
        updatedAt: true,
        folderId: true,
        verified: true,
      },
    });

    const ids = media.map((m) => m.id);
    const activeFileIdSet = new Set<number>();

    if (ids.length > 0) {
      const used = await prisma.playlistFile.findMany({
        where: {
          fileId: { in: ids },
          playlist: {
            players: { some: { linked: true } },
          },
        },
        select: { fileId: true },
      });

      for (const u of used) {
        if (typeof u.fileId === "number") activeFileIdSet.add(u.fileId);
      }
    }

    let enriched = await Promise.all(
      media.map(async (m) => {
        const signedUrl = await generateSignedUrl(m.fileKey);
        const sizeBytes = Number(m.fileSize ?? 0);
        const safeSizeBytes = Number.isFinite(sizeBytes) ? sizeBytes : 0;

        const durationRaw = Number(m.duration ?? 0);
        const safeDuration = Number.isFinite(durationRaw) ? durationRaw : 0;

        const mediaStatus: MediaStatus = activeFileIdSet.has(m.id)
          ? "active"
          : "inactive";

        return {
          ...m,
          url: signedUrl,
          fileSize: safeSizeBytes,
          duration: safeDuration,
          status: mediaStatus,
          fileTypeGroup: toTopLevelType(m.fileType),
        };
      }),
    );

    const sb: SizeBucket | undefined = sizeBucket;
    if (sb) {
      enriched = enriched.filter((x) => {
        if (sb === "0-10") return x.fileSize >= 0 && x.fileSize < 10;
        if (sb === "10-100") return x.fileSize >= 10 && x.fileSize < 100;
        if (sb === "100+") return x.fileSize >= 100;
        return true;
      });
    }

    const st: MediaStatus | undefined = status;
    if (st) {
      enriched = enriched.filter((x) => x.status === st);
    }

    enriched.sort((a, b) => {
      switch (parsedSortBy) {
        case "name":
          return compare(
            a.name.toLowerCase(),
            b.name.toLowerCase(),
            parsedSortOrder,
          );
        case "size":
          return compare(a.fileSize, b.fileSize, parsedSortOrder);
        case "createdAt":
          return compare(
            new Date(a.createdAt).getTime(),
            new Date(b.createdAt).getTime(),
            parsedSortOrder,
          );
        case "fileType":
          return compare(
            (a.fileType ?? "").toLowerCase(),
            (b.fileType ?? "").toLowerCase(),
            parsedSortOrder,
          );
        default:
          return 0;
      }
    });

    return reply.status(200).send({
      message: "Media fetched successfully",
      media: enriched,
      folder: folder.name,
      meta: {
        folderId: folder_id,
        sortBy: parsedSortBy,
        sortOrder: parsedSortOrder,
        search: searchTerm,
        filters: {
          fileType: fileType ?? null,
          status: st ?? null,
          sizeBucket: sb ?? null,
          from: fromDate?.toISOString() ?? null,
          to: toDate?.toISOString() ?? null,
        },
      },
    });
  } catch (e) {
    console.log("Get media error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};


export const editFileName = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { fileId, name } = req.body as { fileId: number; name: string };

    const trimmedName = name?.trim();
    if (!trimmedName)
      return reply.status(400).send({ message: "Invalid name" });

    const file = await prisma.file.findFirst({
      where: { id: Number(fileId), isDeleted: false },
      select: { id: true, folderId: true },
    });
    if (!file) return reply.status(404).send({ message: "File not found" });

    const existing = await prisma.file.findFirst({
      where: {
        folderId: file.folderId,
        isDeleted: false,
        name: trimmedName,
        id: { not: Number(fileId) },
      },
      select: { id: true },
    });
    if (existing)
      return reply.status(400).send({ message: "File name exists" });

    const updated = await prisma.file.update({
      where: { id: Number(fileId) },
      data: { name: trimmedName },
      select: { id: true, name: true, folderId: true, updatedAt: true },
    });

    return reply.status(200).send({
      message: "File name updated successfully",
      file: updated,
    });
  } catch (e) {
    console.log("Edit file name error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const deleteFile = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { fileId } = req.body as { fileId: number };
    const id = Number(fileId);
    if (!Number.isFinite(id))
      return reply.status(400).send({ message: "Invalid fileId" });

    const file = await prisma.file.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, fileKey: true },
    });
    if (!file) return reply.status(404).send({ message: "File not found" });

    await prisma.playlistFile.deleteMany({
      where: { fileId: id },
    });

    await prisma.file.update({
      where: { id },
      data: { deletedAt: new Date(), isDeleted: true },
    });

    return reply.status(200).send({ message: "File deleted successfully" });
  } catch (e) {
    console.log("Delete file error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const bulkDeleteFile = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { fileIds } = req.body as { fileIds: number[] };
    const ids = Array.isArray(fileIds)
      ? fileIds.map(Number).filter(Number.isFinite)
      : [];
    if (ids.length === 0)
      return reply.status(400).send({ message: "Invalid fileIds" });

    const files = await prisma.file.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: { fileKey: true },
    });

    if (files.length === 0)
      return reply.status(404).send({ message: "Files not found" });

    const now = new Date();

    await prisma.playlistFile.deleteMany({
      where: { fileId: { in: ids } },
    });

    await prisma.file.updateMany({
      where: { id: { in: ids }, isDeleted: false },
      data: { deletedAt: now, isDeleted: true },
    });

    return reply.status(200).send({ message: "Files deleted successfully" });
  } catch (e) {
    console.log("Bulk delete file error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const bulkFolderDelete = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { folderIds } = req.body as { folderIds: number[] };
    const ids = Array.isArray(folderIds)
      ? folderIds.map(Number).filter(Number.isFinite)
      : [];
    if (ids.length === 0)
      return reply.status(400).send({ message: "Invalid folderIds" });

    const folders = await prisma.folder.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: { id: true },
    });
    if (folders.length === 0)
      return reply.status(404).send({ message: "Folders not found" });

    const files = await prisma.file.findMany({
      where: { folderId: { in: ids }, isDeleted: false },
      select: { fileKey: true, id: true },
    });

    const now = new Date();
    const fileIds = files.map((f) => f.id);

    await prisma.$transaction(async (tx) => {
      await tx.playlistFile.deleteMany({
        where: { fileId: { in: fileIds } },
      });
      await tx.file.updateMany({
        where: { id: { in: fileIds }, isDeleted: false },
        data: { deletedAt: now, isDeleted: true },
      });

      await tx.folder.updateMany({
        where: { id: { in: ids }, isDeleted: false },
        data: { deletedAt: now, isDeleted: true },
      });
    });

    return reply.status(200).send({ message: "Folders deleted successfully" });
  } catch (e) {
    console.log("Bulk delete folder error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getClients = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const clients = await prisma.folder.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
    });

    return reply
      .status(200)
      .send({ message: "Clients fetched successfully", clients });
  } catch (e) {
    console.log("Get clients error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const getFolderFiles = async (
  req: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { folderId } = req.params as { folderId: number };
    const id = Number(folderId);

    if (!Number.isFinite(id)) {
      return reply.status(400).send({ message: "Invalid folderId" });
    }

    const folder = await prisma.folder.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, name: true },
    });

    if (!folder) return reply.status(404).send({ message: "Folder not found" });

    const files = await prisma.file.findMany({
      where: { folderId: id, isDeleted: false }, // ✅ use id (number)
      select: { id: true, name: true, fileType: true, fileKey: true,duration: true },
    });

    const fileUrlUpdate = await Promise.all(
      files.map(async (f) => ({
        ...f,
        url: await generateSignedUrl(f.fileKey),
      })),
    );

    return reply.status(200).send({
      message: "Files fetched successfully",
      fileUrlUpdate,
    });
  } catch (e) {
    console.log("Get folder files error: ", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};
