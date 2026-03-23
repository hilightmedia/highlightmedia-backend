import { prisma } from "../db/client";
import { deleteFilesFromS3 } from "../services/file";

const BATCH_SIZE = 50;
const MAX_BATCHES = 100;

async function cleanupTrash() {
  console.log("[CRON] Cleaning trash...");

  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let batchCount = 0;

  while (batchCount < MAX_BATCHES) {
    const files = await prisma.file.findMany({
      where: {
        isDeleted: true,
        deletedAt: { lte: threshold },
      },
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
      select: { id: true, fileKey: true },
    });

    if (!files.length) break;

    const fileIds = files.map((f) => f.id);
    const keys = files.map((f) => f.fileKey);

    try {
      await prisma.$transaction([
        prisma.playlistFile.deleteMany({
          where: { fileId: { in: fileIds } },
        }),
        prisma.file.deleteMany({
          where: { id: { in: fileIds } },
        }),
      ]);

      try {
        await deleteFilesFromS3(keys);
      } catch (s3Err) {
        console.error("[CRON] S3 delete failed:", keys, s3Err);
      }

      console.log(`[CRON] Deleted batch of ${files.length}`);
    } catch (err) {
      console.error("[CRON] Batch failed:", err);
      break;
    }

    batchCount++;

    // 🧠 throttle
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log("[CRON] Trash cleanup done");

  await deleteEmptyFolders();
}

async function deleteEmptyFolders() {
  console.log("[CRON] Cleaning empty folders...");

  const deleted = await prisma.$executeRaw`
    DELETE FROM "Folders"
    WHERE "isDeleted" = true
    AND "deletedAt" <= NOW() - INTERVAL '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM "Files" f WHERE f."folderId" = "Folders"."id"
    );
  `;

  console.log(`[CRON] Deleted ${deleted} empty folders`);
}