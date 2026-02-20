-- CreateTable
CREATE TABLE "Alerts" (
    "id" SERIAL NOT NULL,
    "folderId" INTEGER NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "daysLeft" INTEGER,
    "alertDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alerts_at_idx" ON "Alerts"("at");

-- CreateIndex
CREATE INDEX "Alerts_folderId_idx" ON "Alerts"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Alerts_folderId_type_alertDate_key" ON "Alerts"("folderId", "type", "alertDate");

-- AddForeignKey
ALTER TABLE "Alerts" ADD CONSTRAINT "Alerts_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
