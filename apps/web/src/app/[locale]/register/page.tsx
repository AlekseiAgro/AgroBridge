import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/AuthForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link, redirect } from '@/i18n/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  const nextPath = safeNextPath(next, '/account');
  const user = await getCurrentUser();
  if (user) {
    redirect({ href: nextPath, locale });
  }

  const t = await getTranslations('auth');

  return (
    <div className="auth-page">
      <header className="auth-page__top">
        <Link href="/" className="auth-brand">
          AgroBridge
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="auth-card">
        <h1>{t('registerTitle')}</h1>
        <p className="auth-card__subtitle">{t('registerSubtitle')}</p>
        <AuthForm mode="register" nextPath={nextPath} />
        <p className="auth-card__footer">
          {t('hasAccount')}{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}>
            {t('goLogin')}
          </Link>
        </p>
      </main>
    </div>
  );
}
