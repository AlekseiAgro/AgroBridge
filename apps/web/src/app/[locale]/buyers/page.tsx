import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RoleHub } from '@/components/RoleHub';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BuyersHubPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('roleHubs.buyers');
  const tn = await getTranslations('nav');
  const user = await getCurrentUser();
  const isBuyer = user?.role === 'buyer' || user?.role === 'admin';

  const asideLinks = isBuyer
    ? [
        { href: '/dashboard/purchase-requests', label: t('asideMine') },
        { href: '/dashboard/rfqs', label: tn('myRequests') },
        { href: '/dashboard/chat', label: tn('chat') },
      ]
    : user
      ? [{ href: '/account', label: tn('account') }]
      : [
          { href: '/login?next=/requests/new', label: tn('login') },
          { href: '/register?next=/requests/new', label: t('asideRegister') },
        ];

  const requestHref = '/requests/new';

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
              href: requestHref,
              title: t('paths.request.title'),
              text: t('paths.request.text'),
              cta: t('paths.request.cta'),
              imageSrc: '/images/categories/berries.jpg',
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
