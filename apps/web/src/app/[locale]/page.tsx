import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CategoryShowcase } from '@/components/CategoryShowcase';
import { HowItWorksSection } from '@/components/HowItWorksSection';
import { BrandLogo } from '@/components/BrandLogo';
import { SiteFooter } from '@/components/SiteFooter';
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
      <section className="home-hero">
        <div className="home-hero__media" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero/farm-landscape.jpg"
            alt=""
            className="home-hero__image"
          />
        </div>
        <div className="home-hero__veil" aria-hidden />

        <div className="home-hero__shell">
          <SiteHeader tone="light" />
          <div className="home-hero__content">
            <div className="home__brand">
              <BrandLogo variant="stacked" tone="light" />
            </div>
            <h1 className="home__headline">{t('headline')}</h1>
            <p className="home__subtitle">{t('subtitle')}</p>

            <div className="home__actions">
              <Link className="button button--primary" href="/catalog">
                {t('ctaPrimary')}
              </Link>
              {user?.role === 'farmer' || user?.role === 'admin' ? (
                <Link className="button button--ghost-light" href="/dashboard/farm">
                  {t('ctaFarm')}
                </Link>
              ) : user ? (
                <Link className="button button--ghost-light" href="/account">
                  {t('ctaAccount')}
                </Link>
              ) : (
                <Link className="button button--ghost-light" href="/register">
                  {t('ctaSecondary')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="home-body">
        <CategoryShowcase />
        <div className="home-panel">
          <HowItWorksSection />
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
