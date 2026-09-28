import { canTrade } from '@agrobridge/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { staticPublicMetadata } from '@/lib/seo-public-metadata';
import { RoleHub } from '@/components/RoleHub';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return staticPublicMetadata(locale, 'sellers');
}

export default async function SellersHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('roleHubs.sellers');
  const user = await getCurrentUser();
  const trader = Boolean(user && canTrade(user.role));
  const offerHref = trader ? '/dashboard/products/new' : '/register';

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main page__main--wide">
        <RoleHub
          eyebrow={t('eyebrow')}
          title={t('title')}
          lead={t('lead')}
          paths={[
            {
              href: '/requests',
              title: t('paths.requests.title'),
              text: t('paths.requests.text'),
              cta: t('paths.requests.cta'),
              imageSrc: '/images/categories/vegetables.jpg',
            },
            {
              href: offerHref,
              title: t('paths.offer.title'),
              text: t('paths.offer.text'),
              cta: t('paths.offer.cta'),
              imageSrc: '/images/categories/wine.jpg',
            },
          ]}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
