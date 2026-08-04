-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "farmerLastDeliveredAt" TIMESTAMP(3),
ADD COLUMN "buyerLastDeliveredAt" TIMESTAMP(3);
