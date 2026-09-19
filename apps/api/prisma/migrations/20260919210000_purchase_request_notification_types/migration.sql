-- AlterEnum: each value must exist before application code can persist it.
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'purchaseQuoteReceived';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'purchaseQuoteAccepted';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'purchaseQuoteDeclined';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'purchaseRequestClosed';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'purchaseRequestCancelled';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'purchaseQuoteWithdrawn';
