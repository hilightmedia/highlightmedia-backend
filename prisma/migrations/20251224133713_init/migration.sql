-- CreateTable
CREATE TABLE "AdminUsers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" VARCHAR(60) NOT NULL,
    "otp" VARCHAR(6),
    "otpExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUsers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folders" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "validityStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validityEnd" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Files" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "folderId" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "fileType" VARCHAR(30) NOT NULL,
    "fileKey" VARCHAR(1000) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistFiles" (
    "id" SERIAL NOT NULL,
    "playlistId" INTEGER NOT NULL,
    "fileId" INTEGER,
    "subPlaylistId" INTEGER,
    "isSubPlaylist" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaylistFiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Players" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "deviceCode" VARCHAR(16) NOT NULL,
    "deviceKey" VARCHAR(16) NOT NULL,
    "playlistId" INTEGER,
    "location" VARCHAR(100) NOT NULL,
    "linked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSessions" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayLogs" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playlistFileId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayLogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUsers_email_key" ON "AdminUsers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Folders_name_key" ON "Folders"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Files_fileKey_key" ON "Files"("fileKey");

-- CreateIndex
CREATE INDEX "Files_folderId_idx" ON "Files"("folderId");

-- CreateIndex
CREATE INDEX "PlaylistFiles_playlistId_idx" ON "PlaylistFiles"("playlistId");

-- CreateIndex
CREATE INDEX "PlaylistFiles_fileId_idx" ON "PlaylistFiles"("fileId");

-- CreateIndex
CREATE INDEX "PlaylistFiles_subPlaylistId_idx" ON "PlaylistFiles"("subPlaylistId");

-- CreateIndex
CREATE UNIQUE INDEX "Players_name_key" ON "Players"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Players_deviceCode_key" ON "Players"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Players_deviceKey_key" ON "Players"("deviceKey");

-- CreateIndex
CREATE INDEX "Players_playlistId_idx" ON "Players"("playlistId");

-- CreateIndex
CREATE INDEX "PlayerSessions_playerId_idx" ON "PlayerSessions"("playerId");

-- CreateIndex
CREATE INDEX "PlayLogs_playerId_idx" ON "PlayLogs"("playerId");

-- CreateIndex
CREATE INDEX "PlayLogs_playlistFileId_idx" ON "PlayLogs"("playlistFileId");

-- AddForeignKey
ALTER TABLE "Files" ADD CONSTRAINT "Files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistFiles" ADD CONSTRAINT "PlaylistFiles_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistFiles" ADD CONSTRAINT "PlaylistFiles_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "Files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistFiles" ADD CONSTRAINT "PlaylistFiles_subPlaylistId_fkey" FOREIGN KEY ("subPlaylistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Players" ADD CONSTRAINT "Players_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSessions" ADD CONSTRAINT "PlayerSessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayLogs" ADD CONSTRAINT "PlayLogs_playlistFileId_fkey" FOREIGN KEY ("playlistFileId") REFERENCES "PlaylistFiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
