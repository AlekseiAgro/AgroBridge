export const VERIFICATION_STATUSES = [
  'unverified',
  'pending',
  'approved',
  'rejected',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export function isVerificationStatus(value: string): value is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

/**
 * Why a farm sits in its current verification state. The producer UI and the decision
 * emails translate this code, so moderation never ships English internals to a seller.
 */
export const VERIFICATION_REASON_CODES = [
  'documentRejected',
  'registryNotConfirmed',
  'contactConfirmationRequired',
  'moderatorRejected',
] as const;
export type VerificationReasonCode = (typeof VERIFICATION_REASON_CODES)[number];

export function isVerificationReasonCode(value: string): value is VerificationReasonCode {
  return (VERIFICATION_REASON_CODES as readonly string[]).includes(value);
}

export const DOCUMENT_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];

export function isDocumentReviewStatus(value: string): value is DocumentReviewStatus {
  return (DOCUMENT_REVIEW_STATUSES as readonly string[]).includes(value);
}

export const FARM_DOCUMENT_KINDS = ['idCard', 'businessRegistration', 'other'] as const;
export type FarmDocumentKind = (typeof FARM_DOCUMENT_KINDS)[number];

export function isFarmDocumentKind(value: string): value is FarmDocumentKind {
  return (FARM_DOCUMENT_KINDS as readonly string[]).includes(value);
}

/**
 * Document that submits identity verification for moderation, per seller type.
 * Uploading it is the submission: there is no separate "send to moderator" action.
 */
export const PRIMARY_VERIFICATION_DOCUMENT_KIND = {
  privateFarmer: 'idCard',
  company: 'businessRegistration',
} as const satisfies Record<'privateFarmer' | 'company', FarmDocumentKind>;

const PRIMARY_VERIFICATION_DOCUMENT_KINDS: readonly string[] = Object.values(
  PRIMARY_VERIFICATION_DOCUMENT_KIND,
);

/** True for the documents that drive the farm-level verification state. */
export function isPrimaryVerificationDocumentKind(value: string): value is FarmDocumentKind {
  return PRIMARY_VERIFICATION_DOCUMENT_KINDS.includes(value);
}

export const FARM_DOCUMENT_MAX_COUNT = 10;
export const FARM_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const FARM_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type FarmDocumentMimeType = (typeof FARM_DOCUMENT_MIME_TYPES)[number];

export function isFarmDocumentMimeType(value: string): value is FarmDocumentMimeType {
  return (FARM_DOCUMENT_MIME_TYPES as readonly string[]).includes(value);
}

export type FarmDocument = {
  id: string;
  farmId: string;
  title: string;
  fileName: string;
  url: string;
  mimeType: string;
  kind: FarmDocumentKind;
  reviewStatus: DocumentReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

/** Farmer-facing voluntary verification progress. */
export type ProducerVerificationStatus = {
  verified: boolean;
  farmVerificationStatus: VerificationStatus;
  /** Translatable explanation of the current state; null when there is nothing to explain. */
  verificationReasonCode: VerificationReasonCode | null;
  /** A moderator's own words. Not translated, and never an internal status message. */
  moderatorComment: string | null;
  sellerType: 'privateFarmer' | 'company' | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  companyRegistrationNumber: string | null;
  companyRegistryName: string | null;
  companyRegistryValid: boolean | null;
  hasApprovedIdDocument: boolean;
  hasPendingIdDocument: boolean;
  /** A primary identity document for the selected seller type is awaiting moderation. */
  hasPendingVerificationDocument: boolean;
  sellerTypeLocked: boolean;
  path: 'company' | 'privateFarmer' | 'unknown';
  steps: {
    email: 'done' | 'todo';
    phone: 'done' | 'todo';
    identity: 'done' | 'todo' | 'pending_review' | 'rejected';
  };
};
