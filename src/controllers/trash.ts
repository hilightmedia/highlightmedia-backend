import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db/client";
import { generateSignedUrl } from "../services/file";
import toHttpError from "../utils/toHttpError";

type TrashKind = "folder" | "file";

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatDDMMYYYY = (d: Date) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

const splitNameExt = (name: string) => {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return { base: name, ext: "" };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
};

const nextName = async (
  desired: string,
  exists: (candidate: string) => Promise<boolean>
) => {
  if (!(await exists(desired))) return desired;
  const { base, ext } = splitNameExt(desired);
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
};

export const getTrash = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { search } = (req.query as any) ?? {};
    const q =
      typeof search === "string" && search.trim().length > 0
        ? search.trim()
        : null;

    const [folders, files] = await Promise.all([
      prisma.folder.findMany({
        where: {
          isDeleted: true,
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        },
        orderBy: { deletedAt: "desc" },
        select: { id: true, name: true, deletedAt: true },
      }),
      prisma.file.findMany({
        where: {
          isDeleted: true,
          ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        },
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          name: true,
          fileType: true,
          fileKey: true,
          deletedAt: true,
          folder: { select: { id: true, name: true, isDeleted: true } },
        },
      }),
    ]);

    const fileCards = await Promise.all(
      files.map(async (f) => {
        const isImage = (f.fileType ?? "").split("/")[0] === "image";
        const thumbnail = isImage && f.fileKey ? await generateSignedUrl(f.fileKey) : "";
        return {
          kind: "file" as const,
          id: f.id,
          name: f.name,
          type: (f.fileType ?? "").split("/")[0] || "file",
          location: f.folder?.name ?? "",
          folderId: f.folder?.id ?? null,
          folderDeleted: Boolean(f.folder?.isDeleted),
          deletedAt: f.deletedAt,
          deletedAtLabel: f.deletedAt ? formatDDMMYYYY(f.deletedAt) : "",
          thumbnail,
        };
      })
    );

    const folderCards = folders.map((x) => ({
      kind: "folder" as const,
      id: x.id,
      name: x.name,
      type: "folder",
      location: "Media",
      folderId: x.id,
      folderDeleted: true,
      deletedAt: x.deletedAt,
      deletedAtLabel: x.deletedAt ? formatDDMMYYYY(x.deletedAt) : "",
      thumbnail: "",
    }));

    const items = [...folderCards, ...fileCards].sort((a, b) => {
      const ad = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const bd = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return bd - ad;
    });

    return reply.status(200).send({ message: "Trash fetched", items });
  } catch (e) {
    console.log("Get trash error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const restoreTrashItem = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { kind, id } = req.params as any as { kind: TrashKind; id: string };
    const itemId = Number(id);

    if (kind === "folder") {
      const folder = await prisma.folder.findUnique({
        where: { id: itemId },
        select: { id: true, name: true, isDeleted: true },
      });
      if (!folder || !folder.isDeleted) return reply.status(404).send({ message: "Not found" });

      const newFolderName = await nextName(folder.name, async (candidate) => {
        const c = await prisma.folder.count({ where: { name: candidate, isDeleted: false } });
        return c > 0;
      });

      await prisma.folder.update({
        where: { id: itemId },
        data: { isDeleted: false, deletedAt: null, name: newFolderName },
      });

      return reply.status(200).send({ message: "Folder restored" });
    }

    const file = await prisma.file.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        isDeleted: true,
        folderId: true,
        folder: { select: { id: true, name: true, isDeleted: true } },
      },
    });
    if (!file || !file.isDeleted) return reply.status(404).send({ message: "Not found" });

    await prisma.$transaction(async (tx) => {
      if (file.folder?.isDeleted) {
        const restoredFolderName = await nextName(file.folder.name, async (candidate) => {
          const c = await tx.folder.count({ where: { name: candidate, isDeleted: false } });
          return c > 0;
        });

        await tx.folder.update({
          where: { id: file.folder.id },
          data: { isDeleted: false, deletedAt: null, name: restoredFolderName },
        });
      }

      const newFileName = await nextName(file.name, async (candidate) => {
        const c = await tx.file.count({
          where: { folderId: file.folderId, name: candidate, isDeleted: false },
        });
        return c > 0;
      });

      await tx.file.update({
        where: { id: file.id },
        data: { isDeleted: false, deletedAt: null, name: newFileName },
      });
    });

    return reply.status(200).send({ message: "File restored" });
  } catch (e) {
    console.log("Restore trash item error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const deleteTrashItemPermanent = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const { kind, id } = req.params as any as { kind: TrashKind; id: string };
    const itemId = Number(id);

    if (kind === "folder") {
      const folder = await prisma.folder.findUnique({
        where: { id: itemId },
        select: { id: true, isDeleted: true },
      });
      if (!folder || !folder.isDeleted) return reply.status(404).send({ message: "Not found" });

      await prisma.folder.delete({ where: { id: itemId } });
      return reply.status(200).send({ message: "Folder deleted permanently" });
    }

    const file = await prisma.file.findUnique({
      where: { id: itemId },
      select: { id: true, isDeleted: true },
    });
    if (!file || !file.isDeleted) return reply.status(404).send({ message: "Not found" });

    await prisma.file.delete({ where: { id: itemId } });
    return reply.status(200).send({ message: "File deleted permanently" });
  } catch (e) {
    console.log("Delete trash item error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const restoreAllTrash = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { isDeleted: true },
      select: { id: true, name: true },
      orderBy: { deletedAt: "desc" },
    });

    await prisma.$transaction(async (tx) => {
      for (const f of folders) {
        const newName = await nextName(f.name, async (candidate) => {
          const c = await tx.folder.count({ where: { name: candidate, isDeleted: false } });
          return c > 0;
        });
        await tx.folder.update({
          where: { id: f.id },
          data: { isDeleted: false, deletedAt: null, name: newName },
        });
      }

      const files = await tx.file.findMany({
        where: { isDeleted: true },
        select: { id: true, name: true, folderId: true },
        orderBy: { deletedAt: "desc" },
      });

      for (const fl of files) {
        const newFileName = await nextName(fl.name, async (candidate) => {
          const c = await tx.file.count({
            where: { folderId: fl.folderId, name: candidate, isDeleted: false },
          });
          return c > 0;
        });

        await tx.file.update({
          where: { id: fl.id },
          data: { isDeleted: false, deletedAt: null, name: newFileName },
        });
      }
    });

    return reply.status(200).send({ message: "All items restored" });
  } catch (e) {
    console.log("Restore all trash error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};

export const emptyTrash = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    await prisma.$transaction(async (tx) => {
      const deletedFolderIds = await tx.folder.findMany({
        where: { isDeleted: true },
        select: { id: true },
      });

      if (deletedFolderIds.length > 0) {
        await tx.folder.deleteMany({
          where: { id: { in: deletedFolderIds.map((x) => x.id) } },
        });
      }

      await tx.file.deleteMany({ where: { isDeleted: true } });
    });

    return reply.status(200).send({ message: "Trash emptied" });
  } catch (e) {
    console.log("Empty trash error:", e);
    const { status, payload } = toHttpError(e);
    return reply.status(status).send(payload);
  }
};
