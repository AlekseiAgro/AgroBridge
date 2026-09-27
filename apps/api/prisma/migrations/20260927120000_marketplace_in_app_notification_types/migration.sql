-- AlterEnum: each value must exist before application code can persist it.
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'newPurchaseRequest';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'chatMessage';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'rfqCreated';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'rfqOfferCreated';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'rfqAccepted';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'rfqDeclinedByBuyer';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'rfqDeclinedByFarmer';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'rfqCancelled';
