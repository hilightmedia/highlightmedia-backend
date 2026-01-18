/*
  Warnings:

  - Added the required column `duration` to the `PlaylistFiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PlaylistFiles" ADD COLUMN "duration" INTEGER NOT NULL default 30;
ALTER TABLE "PlaylistFiles"
ALTER COLUMN "duration" SET NOT NULL;
