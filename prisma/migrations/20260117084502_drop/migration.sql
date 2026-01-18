-- DropIndex
DROP INDEX "PlaylistFiles_fileId_idx";

-- DropIndex
DROP INDEX "PlaylistFiles_playlistId_fileId_key";

-- DropIndex
DROP INDEX "PlaylistFiles_playlistId_subPlaylistId_key";

-- DropIndex
DROP INDEX "PlaylistFiles_subPlaylistId_idx";

-- CreateIndex
CREATE INDEX "PlaylistFiles_playlistId_fileId_idx" ON "PlaylistFiles"("playlistId", "fileId");

-- CreateIndex
CREATE INDEX "PlaylistFiles_playlistId_subPlaylistId_idx" ON "PlaylistFiles"("playlistId", "subPlaylistId");
