import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
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
      <SiteHeader />

      <main className="home__hero">
        <p className="home__brand">{t('brand')}</p>
        <h1 className="home__headline">{t('headline')}</h1>
        <p className="home__subtitle">{t('subtitle')}</p>

        <div className="home__actions">
          <Link className="button button--primary" href="/catalog">
            {t('ctaPrimary')}
          </Link>
          {user?.role === 'farmer' || user?.role === 'admin' ? (
            <Link className="button button--ghost" href="/dashboard/farm">
              {t('ctaFarm')}
            </Link>
          ) : user ? (
            <Link className="button button--ghost" href="/account">
              {t('ctaAccount')}
            </Link>
          ) : (
            <Link className="button button--ghost" href="/register">
              {t('ctaSecondary')}
            </Link>
          )}
        </div>

        <p className="home__hint">{t('languagesHint')}</p>
      </main>
    </div>
  );
}
