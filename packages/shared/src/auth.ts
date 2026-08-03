import { USER_ROLES, type UserRole } from './roles';
import type { Locale } from './locales';
import type { RatingSummary } from './rating';

/** Roles that can self-register. Admin is provisioned separately. */
export const REGISTERABLE_ROLES = ['farmer', 'buyer'] as const;

export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

/** Seller classification chosen at registration (farmers only). */
export const SELLER_TYPES = ['privateFarmer', 'company'] as const;

export type SellerType = (typeof SELLER_TYPES)[number];

/** Buyer classification chosen at registration (buyers only). */
export const BUYER_TYPES = ['individual', 'company'] as const;

export type BuyerType = (typeof BUYER_TYPES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isRegisterableRole(value: string): value is RegisterableRole {
  return (REGISTERABLE_ROLES as readonly string[]).includes(value);
}

export function isSellerType(value: string): value is SellerType {
  return (SELLER_TYPES as readonly string[]).includes(value);
}

export function isBuyerType(value: string): value is BuyerType {
  return (BUYER_TYPES as readonly string[]).includes(value);
}

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  sellerType: SellerType | null;
  buyerType: BuyerType | null;
  locale: Locale;
  displayName: string | null;
  rating: RatingSummary;
};

export type AuthTokenResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
};
