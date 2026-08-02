export const USER_ROLES = ['farmer', 'buyer', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];
