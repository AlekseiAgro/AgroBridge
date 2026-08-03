/** Allow only same-app relative paths for post-auth redirects. */
export function safeNextPath(value: string | null | undefined, fallback = '/account'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('://')) return fallback;
  return value;
}
