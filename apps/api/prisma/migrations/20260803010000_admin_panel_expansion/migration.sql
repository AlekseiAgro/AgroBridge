-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "blockedAt" TIMESTAMP(3),
ADD COLUMN "blockedReason" TEXT,
ADD COLUMN "blockedById" TEXT;

-- AlterTable Farm
ALTER TABLE "Farm" ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "verificationNote" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedById" TEXT;

-- AlterTable purchase_requests
ALTER TABLE "purchase_requests" ADD COLUMN "moderationNote" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "moderatedById" TEXT;

-- CreateTable
CREATE TABLE "farm_documents" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_configs" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_blockedAt_idx" ON "User"("blockedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Farm_verificationStatus_idx" ON "Farm"("verificationStatus");

-- CreateIndex
CREATE INDEX "farm_documents_farmId_reviewStatus_idx" ON "farm_documents"("farmId", "reviewStatus");

-- CreateIndex
CREATE INDEX "farm_documents_reviewStatus_createdAt_idx" ON "farm_documents"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "category_configs_enabled_sortOrder_idx" ON "category_configs"("enabled", "sortOrder");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_documents" ADD CONSTRAINT "farm_documents_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_documents" ADD CONSTRAINT "farm_documents_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
