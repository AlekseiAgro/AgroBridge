import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthLegalLinks } from '@/components/AuthLegalLinks';
import { BrandLogo } from '@/components/BrandLogo';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link, redirect } from '@/i18n/navigation';
import { noindexRobots } from '@/lib/seo-robots';
import { getCurrentUser } from '@/lib/session';

export const metadata = {
  robots: noindexRobots,
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ForgotPasswordPage({ params }: Props) {
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
          <BrandLogo />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="auth-card">
        <h1>{t('forgotPasswordTitle')}</h1>
        <p className="auth-card__subtitle">{t('forgotPasswordSubtitle')}</p>
        <ForgotPasswordForm />
        <p className="auth-card__footer">
          <Link href="/login">{t('backToLogin')}</Link>
        </p>
        <AuthLegalLinks />
      </main>
    </div>
  );
}
