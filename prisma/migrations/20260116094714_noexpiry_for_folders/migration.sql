-- AlterTable
ALTER TABLE "Folders" ALTER COLUMN "validityStart" DROP NOT NULL,
ALTER COLUMN "validityStart" DROP DEFAULT,
ALTER COLUMN "validityEnd" DROP NOT NULL;
