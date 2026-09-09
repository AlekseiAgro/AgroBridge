import type { BuyerType, Locale, SellerType, UserRole } from '@agrobridge/shared';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  locale: Locale;
  /** User.authVersion at issue time. Missing on tokens minted before password recovery. */
  ver?: number;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  sellerType: SellerType | null;
  buyerType: BuyerType | null;
  locale: Locale;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
};
