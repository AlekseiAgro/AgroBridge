const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

/** Parse `WEB_ORIGIN` (comma-separated) for CORS during a domain cutover. */
export function parseCorsOrigins(value: string | undefined): string[] {
  const origins = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return origins?.length ? origins : [DEFAULT_WEB_ORIGIN];
}
