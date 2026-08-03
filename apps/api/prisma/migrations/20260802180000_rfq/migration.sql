-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('pending', 'offered', 'accepted', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('GEL', 'EUR', 'USD');

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unit" TEXT,
    "message" TEXT,
    "status" "RfqStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqOffer" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "priceAmount" DECIMAL(12,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "message" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rfq_buyerId_createdAt_idx" ON "Rfq"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "Rfq_farmId_status_createdAt_idx" ON "Rfq"("farmId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Rfq_productId_idx" ON "Rfq"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RfqOffer_rfqId_key" ON "RfqOffer"("rfqId");

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqOffer" ADD CONSTRAINT "RfqOffer_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;
