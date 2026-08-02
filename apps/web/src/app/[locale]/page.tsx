import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <div className="home">
      <header className="home__top">
        <LanguageSwitcher />
      </header>

      <main className="home__hero">
        <p className="home__brand">{t('brand')}</p>
        <h1 className="home__headline">{t('headline')}</h1>
        <p className="home__subtitle">{t('subtitle')}</p>

        <div className="home__actions">
          <a className="button button--primary" href={`/${locale}/catalog`}>
            {t('ctaPrimary')}
          </a>
          <a className="button button--ghost" href={`/${locale}/join`}>
            {t('ctaSecondary')}
          </a>
        </div>

        <p className="home__hint">{t('languagesHint')}</p>
      </main>
    </div>
  );
}
