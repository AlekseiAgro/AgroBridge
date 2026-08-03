-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('individual', 'company');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "buyerType" "BuyerType";
