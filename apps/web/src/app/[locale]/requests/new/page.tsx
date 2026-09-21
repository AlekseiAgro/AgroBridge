import { canTrade } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PurchaseRequestForm } from '@/components/PurchaseRequestForm';
import { Link, redirect } from '@/i18n/navigation';
import { requireVerifiedUser } from '@/lib/require-verified-user';
import { noindexRobots } from '@/lib/seo-robots';

export const metadata = {
  robots: noindexRobots,
};

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewPurchaseRequestPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireVerifiedUser(locale, '/requests/new');

  const t = await getTranslations('purchaseRequests');
  const tn = await getTranslations('nav');

  if (!canTrade(user.role)) {
    redirect({ href: '/account', locale });
  }

  return (
    <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/buyers">{tn('forBuyers')}</Link>
          {' · '}
          <Link href="/requests">{t('boardTitle')}</Link>
        </p>
        <h1>{t('createTitle')}</h1>
        <p className="page__subtitle">{t('createSubtitle')}</p>
        <PurchaseRequestForm />
    </main>
  );
}
