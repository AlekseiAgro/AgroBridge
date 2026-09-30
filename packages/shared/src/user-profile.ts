import type { BuyerType, SellerType } from './auth';
import type { RatingSummary } from './rating';
import type { UserRole } from './roles';

/** Public-facing profile. Never includes email or auth secrets. */
export type PublicUserProfile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  sellerType: SellerType | null;
  buyerType: BuyerType | null;
  /** ISO timestamp of account creation. UI formats as month + year. */
  memberSince: string;
  rating: RatingSummary;
  completedDeals: number;
  farm: {
    id: string;
    name: string;
    region: string | null;
    /** Original farm description. Never replaced by a translation. */
    description: string | null;
    source?: { locale: string; description: string | null };
    display?: {
      locale: string;
      description: string | null;
      translationStatus: 'source' | 'completed' | 'pending' | 'failed';
    };
    productCount: number;
  } | null;
};
