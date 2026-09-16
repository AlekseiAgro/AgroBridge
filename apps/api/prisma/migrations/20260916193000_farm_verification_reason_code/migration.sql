-- CreateEnum
CREATE TYPE "VerificationReasonCode" AS ENUM ('documentRejected', 'registryNotConfirmed', 'contactConfirmationRequired', 'moderatorRejected');

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN "verificationReasonCode" "VerificationReasonCode";

-- Historic rows keep their note for admins, but with no reason code the producer UI and
-- the decision emails stay silent instead of surfacing the old internal English strings.
