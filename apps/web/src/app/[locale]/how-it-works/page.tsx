import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { staticPublicMetadata } from '@/lib/seo-public-metadata';
import { HowItWorksSection } from '@/components/HowItWorksSection';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPublicMetadata(locale, 'howItWorks');
}

export default async function HowItWorksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('howItWorks');

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <HowItWorksSection showActions />
        <p className="page__subtitle" style={{ marginTop: '1.5rem' }}>
          {t('pageNote')}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
