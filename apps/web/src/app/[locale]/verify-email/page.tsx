import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { VerifyEmailForm } from '@/components/VerifyEmailForm';
import { Link, redirect } from '@/i18n/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function VerifyEmailPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  const nextPath = safeNextPath(next, '/account');
  const user = await getCurrentUser();

  if (!user) {
    redirect({ href: `/login?next=${encodeURIComponent('/verify-email')}`, locale });
  }

  if (user!.emailVerified) {
    redirect({ href: nextPath, locale });
  }

  const t = await getTranslations('verifyEmail');

  return (
    <div className="auth-page">
      <header className="auth-page__top">
        <Link href="/" className="auth-brand">
          AgroBridge
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="auth-card">
        <h1>{t('title')}</h1>
        <p className="auth-card__subtitle">{t('subtitle')}</p>
        <VerifyEmailForm email={user!.email} nextPath={nextPath} />
      </main>
    </div>
  );
}
