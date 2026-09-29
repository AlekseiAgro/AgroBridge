/** Public Nest origin documented as NEXT_PUBLIC_API_URL. The path already includes `/api`. */
export const DEFAULT_API_BASE_URL = 'https://api.agrobridge.ge/api';

export const DEFAULT_TIMEOUT_MS = 20_000;

export function resolveApiBaseUrl(value?: string | null): string {
  const trimmed = value?.trim();
  return (trimmed || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

/**
 * Reads Expo's public env if the bundler inlined it.
 * Avoids a Node `process` type so the mobile tsconfig stays free of `@types/node`.
 */
export function readPublicApiUrl(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.EXPO_PUBLIC_API_URL;
}

export function apiBaseUrlFromEnv(): string {
  return resolveApiBaseUrl(readPublicApiUrl());
}

/**
 * Joins a base that already ends in `/api` with an app path such as `/auth/login`.
 * A duplicated `/api` prefix is removed once.
 */
export function joinApiUrl(baseUrl: string, path: string): string {
  const base = resolveApiBaseUrl(baseUrl);
  let suffix = path.startsWith('/') ? path : `/${path}`;
  if (base.endsWith('/api') && (suffix === '/api' || suffix.startsWith('/api/'))) {
    suffix = suffix.slice('/api'.length) || '/';
  }
  return `${base}${suffix}`;
}
