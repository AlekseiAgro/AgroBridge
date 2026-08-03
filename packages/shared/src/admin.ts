import { PRODUCT_CATEGORIES, type ProductCategory } from './catalog';
import type { ModerationStatus } from './moderation';
import type { UserRole } from './roles';
import type { FarmDocument, VerificationStatus } from './verification';

export type {
  DocumentReviewStatus,
  FarmDocument,
  FarmDocumentMimeType,
  VerificationStatus,
} from './verification';

export {
  DOCUMENT_REVIEW_STATUSES,
  FARM_DOCUMENT_MAX_BYTES,
  FARM_DOCUMENT_MAX_COUNT,
  FARM_DOCUMENT_MIME_TYPES,
  VERIFICATION_STATUSES,
  isDocumentReviewStatus,
  isFarmDocumentMimeType,
  isVerificationStatus,
} from './verification';

export type AdminStats = {
  productsPending: number;
  productsApproved: number;
  productsRejected: number;
  farmsTotal: number;
  farmsPendingVerification: number;
  farmsVerified: number;
  usersTotal: number;
  usersBuyers: number;
  usersFarmers: number;
  usersBlocked: number;
  registrationsLast7Days: number;
  registrationsLast30Days: number;
  dealsCompleted: number;
  dealsInProgress: number;
  purchaseRequestsOpen: number;
  purchaseRequestsFulfilled: number;
  documentsPending: number;
  registrationsByDay: Array<{ date: string; count: number }>;
};

export type AdminUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  locale: string;
  createdAt: string;
  blockedAt: string | null;
  blockedReason: string | null;
  farm: { id: string; name: string; verificationStatus: VerificationStatus } | null;
  completedDeals: number;
};

export type AdminFarm = {
  id: string;
  name: string;
  region: string | null;
  description: string | null;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  verifiedAt: string | null;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    displayName: string | null;
    blockedAt: string | null;
  };
  productCount: number;
  pendingDocuments: number;
  documents: FarmDocument[];
};

export type CategoryConfigItem = {
  id: ProductCategory | string;
  enabled: boolean;
  sortOrder: number;
};

export type AdminPurchaseRequest = {
  id: string;
  title: string;
  category: string;
  quantity: string;
  unit: string | null;
  status: string;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  buyer: {
    id: string;
    email: string;
    displayName: string | null;
  };
  quoteCount: number;
};

export type AdminDeal = {
  id: string;
  kind: 'rfq' | 'purchase_request';
  title: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  buyer: {
    id: string;
    email: string;
    displayName: string | null;
  };
  seller: {
    id: string;
    email: string;
    displayName: string | null;
    farmName: string | null;
  } | null;
};

export type ModeratedProduct = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  isPublished: boolean;
  moderationStatus: ModerationStatus;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    displayName: string | null;
    email: string;
  };
  farm: {
    id: string;
    name: string;
    region: string | null;
  } | null;
};

export const ADMIN_SECTIONS = [
  'overview',
  'products',
  'farms',
  'users',
  'requests',
  'deals',
  'categories',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function isAdminSection(value: string): value is AdminSection {
  return (ADMIN_SECTIONS as readonly string[]).includes(value);
}

/** Ensures every known catalog category has a config row shape. */
export function mergeCategoryConfigs(
  rows: Array<{ id: string; enabled: boolean; sortOrder: number }>,
): CategoryConfigItem[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return PRODUCT_CATEGORIES.map((id, index) => {
    const existing = byId.get(id);
    return {
      id,
      enabled: existing?.enabled ?? true,
      sortOrder: existing?.sortOrder ?? index,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}
