-- AlterEnum
ALTER TYPE "RfqStatus" ADD VALUE 'completed';

-- AlterTable
ALTER TABLE "Rfq" ADD COLUMN "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ratings_toUserId_idx" ON "ratings"("toUserId");

-- CreateIndex
CREATE INDEX "ratings_fromUserId_idx" ON "ratings"("fromUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_rfqId_fromUserId_key" ON "ratings"("rfqId", "fromUserId");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
