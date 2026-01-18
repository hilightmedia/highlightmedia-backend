ALTER TABLE "PlaylistFiles"
ADD CONSTRAINT "chk_playlistfiles_item_type"
CHECK (
  ("isSubPlaylist" = false AND "fileId" IS NOT NULL AND "subPlaylistId" IS NULL)
  OR
  ("isSubPlaylist" = true AND "subPlaylistId" IS NOT NULL AND "fileId" IS NULL)
);

CREATE UNIQUE INDEX "ux_playlist_file"
ON "PlaylistFiles" ("playlistId", "fileId")
WHERE "isSubPlaylist" = false;

CREATE UNIQUE INDEX "ux_playlist_subplaylist"
ON "PlaylistFiles" ("playlistId", "subPlaylistId")
WHERE "isSubPlaylist" = true;
