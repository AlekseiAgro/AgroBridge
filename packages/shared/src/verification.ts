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
  verificationNote: string | null;
  sellerType: 'privateFarmer' | 'company' | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  companyRegistrationNumber: string | null;
  companyRegistryName: string | null;
  companyRegistryValid: boolean | null;
  hasApprovedIdDocument: boolean;
  hasPendingIdDocument: boolean;
  path: 'company' | 'privateFarmer' | 'unknown';
  steps: {
    email: 'done' | 'todo';
    phone: 'done' | 'todo';
    identity: 'done' | 'todo' | 'pending_review' | 'rejected';
  };
};
