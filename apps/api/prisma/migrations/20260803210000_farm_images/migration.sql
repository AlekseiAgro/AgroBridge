-- CreateTable
CREATE TABLE "farm_images" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farm_images_farmId_sortOrder_idx" ON "farm_images"("farmId", "sortOrder");

-- AddForeignKey
ALTER TABLE "farm_images" ADD CONSTRAINT "farm_images_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
