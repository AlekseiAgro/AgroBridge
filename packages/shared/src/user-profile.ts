import type { SellerType } from './auth';
import type { RatingSummary } from './rating';
import type { UserRole } from './roles';

/** Public-facing profile. Never includes email or auth secrets. */
export type PublicUserProfile = {
  id: string;
  displayName: string | null;
  role: UserRole;
  sellerType: SellerType | null;
  /** ISO timestamp of account creation. UI formats as month + year. */
  memberSince: string;
  rating: RatingSummary;
  completedDeals: number;
  farm: {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    productCount: number;
  } | null;
};
