import type { PublicUser } from '@agrobridge/shared';
import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import {
  loginRedirectHref,
  protectedNextFromRequest,
  REQUEST_PATHNAME_HEADER,
  REQUEST_SEARCH_HEADER,
  verifyEmailRedirectHref,
} from '@/lib/protected-next-path';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/lib/session';

async function resolveProtectedNextPath(fallback = '/account'): Promise<string> {
  try {
    const requestHeaders = await headers();
    return protectedNextFromRequest(
      requestHeaders.get(REQUEST_PATHNAME_HEADER),
      requestHeaders.get(REQUEST_SEARCH_HEADER),
      fallback,
    );
  } catch {
    return safeNextPath(fallback, '/account');
  }
}

/** Require a signed-in user with a confirmed email for cabinet routes. */
export async function requireVerifiedUser(
  locale: string,
  fallbackPath = '/account',
): Promise<PublicUser> {
  const nextPath = await resolveProtectedNextPath(fallbackPath);
  const user = await getCurrentUser();
  if (!user) {
    redirect({
      href: loginRedirectHref(nextPath),
      locale,
    });
  }
  if (!user!.emailVerified) {
    redirect({
      href: verifyEmailRedirectHref(nextPath),
      locale,
    });
  }
  return user!;
}

/** Redirect unverified signed-in users away from public auth pages into verify flow. */
export function cabinetPathForUser(user: PublicUser, nextPath: string): string {
  if (!user.emailVerified) {
    return verifyEmailRedirectHref(nextPath);
  }
  return nextPath;
}
