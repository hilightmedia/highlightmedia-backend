-- AlterTable
ALTER TABLE "AdminUsers" ADD COLUMN     "otpResendAvailableAt" TIMESTAMP(3),
ADD COLUMN     "otpVerified" BOOLEAN NOT NULL DEFAULT false;
