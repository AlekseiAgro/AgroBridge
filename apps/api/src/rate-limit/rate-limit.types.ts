/** A fixed-window allowance: at most `limit` hits inside `windowMs`. */
export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

/**
 * One counter to consume. `action` names the protected operation and `scope` identifies
 * whoever is being counted (an IP, an account, a hashed email...). Both are combined into
 * the storage key, so the same scope is counted separately per action.
 */
export type RateLimitRule = RateLimitPolicy & {
  action: string;
  scope: string;
};

export type RateLimitHit = {
  /** Hits recorded in the current window, including this one. */
  count: number;
  /** When the current window ends and the counter resets. */
  expiresAt: Date;
};

/**
 * Shared storage for rate-limit counters. Implementations must make `hit` atomic: two
 * concurrent calls for the same key have to produce two different counts, otherwise the
 * limit can be exceeded by racing requests.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
  reset(key: string): Promise<void>;
}

export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');
