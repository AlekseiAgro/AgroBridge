import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { staticPublicMetadata } from '@/lib/seo-public-metadata';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SupportForm } from '@/components/SupportForm';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPublicMetadata(locale, 'support');
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('support');
  const user = await getCurrentUser();

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <h1>{t('title')}</h1>
        <p className="page__subtitle">{t('subtitle')}</p>

        <SupportForm
          defaultName={user?.displayName ?? ''}
          defaultEmail={user?.email ?? ''}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
