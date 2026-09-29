import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/JsonLd';
import { staticPublicMetadata } from '@/lib/seo-public-metadata';
import { buildHomeJsonLd } from '@/lib/seo-jsonld';
import { BrandLogo } from '@/components/BrandLogo';
import { CategoryShowcase } from '@/components/CategoryShowcase';
import { HowItWorksSection } from '@/components/HowItWorksSection';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPublicMetadata(locale, 'home');
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const homeJsonLd = buildHomeJsonLd({
    locale,
    description: t('subtitle'),
    slogan: t('headline'),
  });

  return (
    <div className="home">
      {homeJsonLd ? <JsonLd data={homeJsonLd} /> : null}
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
            <p className="home__brand">
              <BrandLogo />
            </p>
            <h1 className="home__headline">{t('headline')}</h1>
            <p className="home__platform">{t('platform')}</p>
            <p className="home__subtitle">{t('subtitle')}</p>

            <div className="home__actions">
              <Link className="button button--primary" href="/buyers">
                {t('ctaBuyer')}
              </Link>
              <Link className="button button--accent" href="/sellers">
                {t('ctaSeller')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="home-body">
        <CategoryShowcase />
        <div className="home-panel">
          <section className="home-marketplace" aria-labelledby="home-marketplace-title">
            <h2 id="home-marketplace-title" className="home-marketplace__title">
              {t('marketplaceTitle')}
            </h2>
            <p className="home-marketplace__text">{t('marketplaceBody')}</p>
          </section>
          <HowItWorksSection />
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
