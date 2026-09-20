import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RoleHub } from '@/components/RoleHub';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BuyersHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('roleHubs.buyers');

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
              href: '/catalog',
              title: t('paths.catalog.title'),
              text: t('paths.catalog.text'),
              cta: t('paths.catalog.cta'),
              imageSrc: '/images/categories/fruits.jpg',
            },
            {
              href: '/requests/new',
              title: t('paths.request.title'),
              text: t('paths.request.text'),
              cta: t('paths.request.cta'),
              imageSrc: '/images/categories/berries.jpg',
            },
          ]}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
