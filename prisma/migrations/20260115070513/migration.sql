/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Playlist` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[playlistId,fileId]` on the table `PlaylistFiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[playlistId,subPlaylistId]` on the table `PlaylistFiles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fileId` to the `PlayLogs` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PlayLogs" DROP CONSTRAINT "PlayLogs_playerId_fkey";

-- DropForeignKey
ALTER TABLE "PlayLogs" DROP CONSTRAINT "PlayLogs_playlistFileId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerSessions" DROP CONSTRAINT "PlayerSessions_playerId_fkey";

-- AlterTable
ALTER TABLE "PlayLogs" ADD COLUMN     "fileId" INTEGER NOT NULL,
ADD COLUMN     "isSubPlaylist" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playlistId" INTEGER,
ADD COLUMN     "subPlaylistId" INTEGER,
ALTER COLUMN "playlistFileId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Files_name_idx" ON "Files"("name");

-- CreateIndex
CREATE INDEX "PlayLogs_fileId_idx" ON "PlayLogs"("fileId");

-- CreateIndex
CREATE INDEX "PlayLogs_playlistId_idx" ON "PlayLogs"("playlistId");

-- CreateIndex
CREATE INDEX "PlayLogs_subPlaylistId_idx" ON "PlayLogs"("subPlaylistId");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_name_key" ON "Playlist"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistFiles_playlistId_fileId_key" ON "PlaylistFiles"("playlistId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistFiles_playlistId_subPlaylistId_key" ON "PlaylistFiles"("playlistId", "subPlaylistId");

-- AddForeignKey
ALTER TABLE "PlayerSessions" ADD CONSTRAINT "PlayerSessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_playlistFileId_fkey" FOREIGN KEY ("playlistFileId") REFERENCES "PlaylistFiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "Files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_subPlaylistId_fkey" FOREIGN KEY ("subPlaylistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
