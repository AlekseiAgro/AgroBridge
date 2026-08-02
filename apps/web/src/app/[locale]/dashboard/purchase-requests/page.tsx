import type { PurchaseRequestSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PurchaseRequestList } from '@/components/PurchaseRequestList';
import { Link, redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BuyerPurchaseRequestsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'buyer' && user!.role !== 'admin') {
    redirect({ href: '/account', locale });
  }

  const t = await getTranslations('purchaseRequests');
  const items = await apiRequestAuthed<PurchaseRequestSummary[]>('/purchase-requests/mine');

  return (
    <main className="cabinet-page">
      <div className="page__heading-row">
        <div>
          <h1>{t('mineTitle')}</h1>
          <p className="page__subtitle">{t('mineSubtitle')}</p>
        </div>
        <Link href="/requests/new" className="button button--primary">
          {t('createCta')}
        </Link>
      </div>
      <p className="eyebrow">
        <Link href="/requests">{t('boardTitle')}</Link>
        {' · '}
        <Link href="/dashboard/rfqs">{t('productRfqsLink')}</Link>
      </p>
      <PurchaseRequestList items={items} emptyLabel={t('mineEmpty')} />
    </main>
  );
}
