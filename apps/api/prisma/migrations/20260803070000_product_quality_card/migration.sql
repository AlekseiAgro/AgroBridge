-- CreateEnum
CREATE TYPE "ProductImageKind" AS ENUM ('overview', 'closeup', 'packaging', 'harvest', 'field', 'other');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('globalGap', 'organic', 'haccp', 'iso', 'grasp', 'other');

-- AlterTable Farm
ALTER TABLE "Farm" ADD COLUMN "foundedYear" INTEGER,
ADD COLUMN "farmSizeHectares" DECIMAL(12,2),
ADD COLUMN "ownershipType" TEXT,
ADD COLUMN "exportMarkets" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "history" TEXT;

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "variety" TEXT,
ADD COLUMN "country" TEXT DEFAULT 'Georgia',
ADD COLUMN "originPlace" TEXT,
ADD COLUMN "currentStock" DECIMAL(12,2),
ADD COLUMN "monthlyProduction" DECIMAL(12,2),
ADD COLUMN "maxAnnualProduction" DECIMAL(12,2),
ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "packagingTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "packagingWeights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "palletSize" TEXT,
ADD COLUMN "incoterms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "carriers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "customDelivery" TEXT,
ADD COLUMN "nearestPort" TEXT,
ADD COLUMN "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "leadTimeDays" INTEGER,
ADD COLUMN "priceFrom" DECIMAL(12,2),
ADD COLUMN "priceCurrency" TEXT,
ADD COLUMN "priceNegotiable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "priceDependsOnVolume" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable product_images
ALTER TABLE "product_images" ADD COLUMN "kind" "ProductImageKind" NOT NULL DEFAULT 'other';

-- CreateTable
CREATE TABLE "product_videos" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_videos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_certificates" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_certificates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_videos_productId_createdAt_idx" ON "product_videos"("productId", "createdAt");
CREATE INDEX "product_certificates_productId_reviewStatus_idx" ON "product_certificates"("productId", "reviewStatus");
CREATE INDEX "product_certificates_reviewStatus_createdAt_idx" ON "product_certificates"("reviewStatus", "createdAt");

ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_certificates" ADD CONSTRAINT "product_certificates_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_certificates" ADD CONSTRAINT "product_certificates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
