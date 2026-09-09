export const PASSWORD_RESET_TTL_SEC_DEFAULT = 30 * 60;
export const PASSWORD_RESET_TTL_SEC_MIN = 60;
export const PASSWORD_RESET_TTL_SEC_MAX = 24 * 60 * 60;

/** Same body for every outcome of a reset attempt that must not leak token state. */
export const RESET_INVALID_MESSAGE = 'This reset link is invalid or has expired.';
