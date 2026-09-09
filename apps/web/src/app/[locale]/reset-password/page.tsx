import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('auth');
  const trimmed = token?.trim() ?? '';

  return (
    <div className="auth-page">
      <header className="auth-page__top">
        <Link href="/" className="auth-brand">
          AgroBridge
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="auth-card">
        <h1>{t('resetPasswordTitle')}</h1>
        {trimmed ? (
          <>
            <p className="auth-card__subtitle">{t('resetPasswordSubtitle')}</p>
            <ResetPasswordForm token={trimmed} />
          </>
        ) : (
          <p className="form-error">{t('resetPasswordMissingToken')}</p>
        )}
        <p className="auth-card__footer">
          <Link href="/login">{t('backToLogin')}</Link>
        </p>
      </main>
    </div>
  );
}
