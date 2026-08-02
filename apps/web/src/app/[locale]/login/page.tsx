import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthForm } from '@/components/AuthForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link, redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user) {
    redirect({ href: '/account', locale });
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
        <h1>{t('loginTitle')}</h1>
        <p className="auth-card__subtitle">{t('loginSubtitle')}</p>
        <AuthForm mode="login" />
        <p className="auth-card__footer">
          {t('noAccount')} <Link href="/register">{t('goRegister')}</Link>
        </p>
      </main>
    </div>
  );
}
