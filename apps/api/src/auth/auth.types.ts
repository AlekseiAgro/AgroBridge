import type { BuyerType, Locale, SellerType, UserRole } from '@agrobridge/shared';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  locale: Locale;
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

