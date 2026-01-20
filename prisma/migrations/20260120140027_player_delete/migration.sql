-- DropForeignKey
ALTER TABLE "PlayLogs" DROP CONSTRAINT "PlayLogs_playerId_fkey";

-- AlterTable
ALTER TABLE "PlayLogs" ALTER COLUMN "playerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlayerSessions" ADD COLUMN     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
