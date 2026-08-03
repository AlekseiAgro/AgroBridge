export const USER_ROLES = ['farmer', 'buyer', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Every signed-in marketplace account can buy and sell. */
export const MARKETPLACE_ROLES = ['farmer', 'buyer', 'admin'] as const;

export type MarketplaceRole = (typeof MARKETPLACE_ROLES)[number];

export function canTrade(role: UserRole): boolean {
  return (MARKETPLACE_ROLES as readonly string[]).includes(role);
}
