-- AlterTable
ALTER TABLE "Product" ADD COLUMN "ownerUserId" TEXT;

-- Backfill owner from farm ownership
UPDATE "Product" AS p
SET "ownerUserId" = f."ownerId"
FROM "Farm" AS f
WHERE p."farmId" = f."id";

-- Fail loudly if any product could not be backfilled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE "ownerUserId" IS NULL) THEN
    RAISE EXCEPTION 'Product.ownerUserId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "Product" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_farmId_fkey";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "farmId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Product_ownerUserId_idx" ON "Product"("ownerUserId");

-- Make RFQ farm optional as well
ALTER TABLE "Rfq" DROP CONSTRAINT "Rfq_farmId_fkey";
ALTER TABLE "Rfq" ALTER COLUMN "farmId" DROP NOT NULL;
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
