/*
  Warnings:

  - Added the required column `description` to the `ContactSubmissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `ContactSubmissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ContactSubmissions" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "name" VARCHAR(100) NOT NULL;
