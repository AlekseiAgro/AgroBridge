-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('open', 'closed', 'cancelled', 'fulfilled');

-- CreateEnum
CREATE TYPE "PurchaseQuoteStatus" AS ENUM ('pending', 'accepted', 'declined', 'withdrawn');

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unit" TEXT,
    "variety" TEXT,
    "packaging" TEXT,
    "destinationCountry" TEXT,
    "message" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_quotes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "priceAmount" DECIMAL(12,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "quantity" TEXT,
    "unit" TEXT,
    "message" TEXT,
    "validUntil" TIMESTAMP(3),
    "status" "PurchaseQuoteStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_requests_status_createdAt_idx" ON "purchase_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_requests_buyerId_createdAt_idx" ON "purchase_requests"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_requests_category_status_idx" ON "purchase_requests"("category", "status");

-- CreateIndex
CREATE INDEX "purchase_quotes_farmId_createdAt_idx" ON "purchase_quotes"("farmId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_quotes_requestId_status_idx" ON "purchase_quotes"("requestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_quotes_requestId_farmId_key" ON "purchase_quotes"("requestId", "farmId");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
