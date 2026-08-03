import type { PublicUser } from '@agrobridge/shared';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

/** Require a signed-in user with a confirmed email for cabinet routes. */
export async function requireVerifiedUser(
  locale: string,
  nextPath = '/account',
): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect({
      href: `/login?next=${encodeURIComponent(nextPath)}`,
      locale,
    });
  }
  if (!user!.emailVerified) {
    redirect({
      href: `/verify-email?next=${encodeURIComponent(nextPath)}`,
      locale,
    });
  }
  return user!;
}

/** Redirect unverified signed-in users away from public auth pages into verify flow. */
export function cabinetPathForUser(user: PublicUser, nextPath: string): string {
  if (!user.emailVerified) {
    return `/verify-email?next=${encodeURIComponent(nextPath)}`;
  }
  return nextPath;
}
