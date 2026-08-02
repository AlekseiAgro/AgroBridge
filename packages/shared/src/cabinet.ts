import type { RatingSummary } from './rating';
import type { UserRole } from './roles';
import type { Locale } from './locales';

export type CabinetUserCard = {
  id: string;
  email: string;
  role: UserRole;
  locale: Locale;
  displayName: string | null;
  rating: RatingSummary;
  memberSince: string;
};

export type CabinetActivitySummary = {
  completedDeals: number;
  openRequests: number;
  conversations: number;
  publishedProducts: number;
  pendingModeration: number;
  awaitingMyRating: number;
};

export type CabinetOverview = {
  user: CabinetUserCard;
  activity: CabinetActivitySummary;
};
