export const MODERATION_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export function isModerationStatus(value: string): value is ModerationStatus {
  return (MODERATION_STATUSES as readonly string[]).includes(value);
}

/** @deprecated Prefer importing from `./admin` — kept for backward compatibility. */
export type { AdminStats, ModeratedProduct } from './admin';
