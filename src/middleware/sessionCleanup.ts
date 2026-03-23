import { ONLINE_THRESHOLD_MS } from "../config/constants";
import { prisma } from "../db/client";

export const cleanupInactiveSessions = async () => {
  const now = new Date();

  console.log("[Cleanup] Finding inactive sessions...");

  const sessions = await prisma.playerSession.findMany({
    where: {
      isActive: true,
      lastActiveAt: {
        lt: new Date(Date.now() - ONLINE_THRESHOLD_MS),
      },
    },
    select: {
      id: true,
      playerId: true,
    },
  });

  console.log(`[Cleanup] Found ${sessions.length} inactive sessions`);

  if (!sessions.length) return;

  const playerIds = sessions.map((s) => s.playerId);

  console.log("[Cleanup] Fetching latest logs...");

  const latestLogs = await prisma.playLog.groupBy({
    by: ["playerId"],
    where: {
      playerId: { in: playerIds },
    },
    _max: {
      createdAt: true,
    },
  });

  console.log(`[Cleanup] Found ${latestLogs.length} player logs`);

  const logMap = new Map<number, Date>();

  for (const log of latestLogs) {
    if (log.playerId && log._max.createdAt) {
      logMap.set(log.playerId, log._max.createdAt);
    }
  }

  console.log(`[Cleanup] Built logMap with ${logMap.size} entries`);

  // 🔥 SAFE batching (avoid Promise.all explosion)
  const BATCH_SIZE = 50;

  for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
    const batch = sessions.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map((session) => {
        const lastLogTime = logMap.get(session.playerId);

        console.log(
          `[Cleanup] Session ${session.id} → player ${session.playerId} → endedAt = ${
            lastLogTime ?? now
          }`
        );

        return prisma.playerSession.update({
          where: { id: session.id },
          data: {
            isActive: false,
            endedAt: lastLogTime ?? now,
          },
        });
      })
    );
  }

  console.log("[Cleanup] Sessions updated successfully");
};