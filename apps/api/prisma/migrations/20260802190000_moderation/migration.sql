-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'draft';
ALTER TABLE "Product" ADD COLUMN "moderationNote" TEXT;
ALTER TABLE "Product" ADD COLUMN "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "moderatedById" TEXT;

-- Backfill: previously published products become approved
UPDATE "Product"
SET "moderationStatus" = 'approved'
WHERE "isPublished" = true;

-- CreateIndex
CREATE INDEX "Product_moderationStatus_idx" ON "Product"("moderationStatus");

-- CreateIndex
CREATE INDEX "Product_isPublished_moderationStatus_idx" ON "Product"("isPublished", "moderationStatus");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
