-- AlterEnum: must be committed before the new value is usable as a default.
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'unverified';
