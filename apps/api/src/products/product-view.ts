import { createHash } from 'crypto';

/** Same visitor is not counted again for this product within the window. */
export const PRODUCT_VIEW_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Default attribution until paid placement exists. Stored on every row so later
 * reporting can split total / organic / promoted without a second tracking system.
 */
export const PRODUCT_VIEW_SOURCE_ORGANIC = 'organic' as const;

export function productViewVisitorKey(input: {
  userId?: string | null;
  ip: string;
  userAgent: string;
}): string {
  if (input.userId) {
    return `user:${input.userId}`;
  }
  const ua = input.userAgent.trim().slice(0, 200);
  return `guest:${createHash('sha256').update(`${input.ip}\n${ua}`).digest('hex')}`;
}
