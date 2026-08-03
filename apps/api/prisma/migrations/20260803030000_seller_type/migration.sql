-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('privateFarmer', 'company');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sellerType" "SellerType";
