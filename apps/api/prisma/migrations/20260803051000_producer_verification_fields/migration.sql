-- CreateEnum
CREATE TYPE "FarmDocumentKind" AS ENUM ('idCard', 'businessRegistration', 'other');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('email', 'sms');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "phone" TEXT,
ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- AlterTable Farm
ALTER TABLE "Farm" ALTER COLUMN "verificationStatus" SET DEFAULT 'unverified';
ALTER TABLE "Farm" ADD COLUMN "companyRegistrationNumber" TEXT,
ADD COLUMN "companyRegistryName" TEXT,
ADD COLUMN "companyRegistryCheckedAt" TIMESTAMP(3),
ADD COLUMN "companyRegistryValid" BOOLEAN;

-- Existing farms that were auto-pending without intentional review become unverified,
-- except already approved/rejected.
UPDATE "Farm" SET "verificationStatus" = 'unverified' WHERE "verificationStatus" = 'pending';

-- AlterTable farm_documents
ALTER TABLE "farm_documents" ADD COLUMN "kind" "FarmDocumentKind" NOT NULL DEFAULT 'other';

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "VerificationChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verification_codes_userId_channel_createdAt_idx" ON "verification_codes"("userId", "channel", "createdAt");
CREATE INDEX "farm_documents_farmId_kind_idx" ON "farm_documents"("farmId", "kind");

ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
