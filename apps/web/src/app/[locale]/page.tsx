import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const user = await getCurrentUser();

  return (
    <div className="home">
      <header className="home__top">
        <div className="home__nav">
          {user ? (
            <Link href="/account" className="text-link">
              {t('account')}
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-link">
                {t('login')}
              </Link>
              <Link href="/register" className="text-link">
                {t('register')}
              </Link>
            </>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      <main className="home__hero">
        <p className="home__brand">{t('brand')}</p>
        <h1 className="home__headline">{t('headline')}</h1>
        <p className="home__subtitle">{t('subtitle')}</p>

        <div className="home__actions">
          {user ? (
            <Link className="button button--primary" href="/account">
              {t('ctaAccount')}
            </Link>
          ) : (
            <>
              <Link className="button button--primary" href="/register">
                {t('ctaSecondary')}
              </Link>
              <Link className="button button--ghost" href="/login">
                {t('login')}
              </Link>
            </>
          )}
        </div>

        <p className="home__hint">{t('languagesHint')}</p>
      </main>
    </div>
  );
}
