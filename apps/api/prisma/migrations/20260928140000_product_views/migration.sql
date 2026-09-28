-- CreateEnum
CREATE TYPE "ProductViewSource" AS ENUM ('organic', 'promoted');

-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "source" "ProductViewSource" NOT NULL DEFAULT 'organic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_views_productId_createdAt_idx" ON "product_views"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "product_views_productId_visitorKey_createdAt_idx" ON "product_views"("productId", "visitorKey", "createdAt");

-- CreateIndex
CREATE INDEX "product_views_productId_source_idx" ON "product_views"("productId", "source");

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
