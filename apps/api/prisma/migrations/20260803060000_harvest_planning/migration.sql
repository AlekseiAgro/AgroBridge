-- CreateEnum
CREATE TYPE "HarvestStatus" AS ENUM ('growing', 'available', 'limited', 'soldOut');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "seasonMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "harvestStartAt" TIMESTAMP(3),
ADD COLUMN "harvestEndAt" TIMESTAMP(3),
ADD COLUMN "forecastQuantity" DECIMAL(12,2),
ADD COLUMN "harvestStatus" "HarvestStatus",
ADD COLUMN "preorderEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "harvest_watches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "harvest_watches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_harvestStatus_idx" ON "Product"("harvestStatus");

-- CreateIndex
CREATE INDEX "Product_preorderEnabled_idx" ON "Product"("preorderEnabled");

-- CreateIndex
CREATE INDEX "harvest_watches_productId_createdAt_idx" ON "harvest_watches"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "harvest_watches_userId_productId_key" ON "harvest_watches"("userId", "productId");

-- AddForeignKey
ALTER TABLE "harvest_watches" ADD CONSTRAINT "harvest_watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_watches" ADD CONSTRAINT "harvest_watches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
