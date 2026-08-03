import { canTrade } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RoleHub } from '@/components/RoleHub';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SellersHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('roleHubs.sellers');
  const tn = await getTranslations('nav');
  const user = await getCurrentUser();
  const trader = Boolean(user && canTrade(user.role));

  const asideLinks = trader
    ? [
        { href: '/dashboard/products', label: tn('myProducts') },
        { href: '/dashboard/inbox', label: tn('inbox') },
        { href: '/dashboard/farm', label: tn('myFarm') },
        { href: '/dashboard/chat', label: tn('chat') },
      ]
    : [
        { href: '/login', label: tn('login') },
        { href: '/register', label: t('asideRegister') },
      ];

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
          asideNote={t('asideNote')}
          asideLinks={asideLinks}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
