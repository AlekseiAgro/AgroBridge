import { USER_ROLES, type UserRole } from './roles';
import type { Locale } from './locales';

/** Roles that can self-register. Admin is provisioned separately. */
export const REGISTERABLE_ROLES = ['farmer', 'buyer'] as const;

export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isRegisterableRole(value: string): value is RegisterableRole {
  return (REGISTERABLE_ROLES as readonly string[]).includes(value);
}

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  locale: Locale;
  displayName: string | null;
};

export type AuthTokenResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
};
