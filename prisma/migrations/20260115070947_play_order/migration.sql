-- AlterTable
ALTER TABLE "PlaylistFiles" ADD COLUMN     "playOrder" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "PlaylistFiles_playlistId_playOrder_idx" ON "PlaylistFiles"("playlistId", "playOrder");
