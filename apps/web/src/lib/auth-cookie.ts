import { cookies } from 'next/headers';

export const AUTH_COOKIE_NAME = 'agrobridge_token';

const WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function setAuthCookie(token: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: WEEK_SECONDS,
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE_NAME);
}

export async function getAuthToken() {
  const jar = await cookies();
  return jar.get(AUTH_COOKIE_NAME)?.value ?? null;
}
