import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CategoryShowcase } from '@/components/CategoryShowcase';
import { HowItWorksSection } from '@/components/HowItWorksSection';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

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
            <p className="home__brand">AgroBridge</p>
            <h1 className="home__headline">{t('headline')}</h1>
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
          <HowItWorksSection />
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
