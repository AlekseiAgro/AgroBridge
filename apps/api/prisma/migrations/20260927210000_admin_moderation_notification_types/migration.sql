-- AlterEnum: each value must exist before application code can persist it.
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'productApproved';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'productRejected';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'verificationApproved';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'verificationRejected';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'farmDocumentApproved';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'farmDocumentRejected';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'productCertificateApproved';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'productCertificateRejected';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'purchaseRequestModerated';
