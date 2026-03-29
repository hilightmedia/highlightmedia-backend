-- AlterTable
ALTER TABLE "PlayLogs" ADD COLUMN     "duration" VARCHAR(30) NOT NULL DEFAULT '0';

-- CreateTable
CREATE TABLE "EmailSubscription" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSubmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSubmissions" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(60) NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSubmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactSubmissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSubscription_email_key" ON "EmailSubscription"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSubmissions_email_key" ON "ContactSubmissions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSubmissions_mobile_key" ON "ContactSubmissions"("mobile");
