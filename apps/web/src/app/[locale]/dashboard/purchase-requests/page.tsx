import type { PurchaseRequestSummary, RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PurchaseRequestList } from '@/components/PurchaseRequestList';
import { RfqList } from '@/components/RfqList';
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

  const t = await getTranslations('purchaseRequests');
  const tn = await getTranslations('nav');
  const tr = await getTranslations('rfq');
  const [items, rfqs] = await Promise.all([
    apiRequestAuthed<PurchaseRequestSummary[]>('/purchase-requests/mine'),
    apiRequestAuthed<RfqSummary[]>('/rfqs/mine'),
  ]);

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
        <Link href="/catalog">{tr('browseCatalog')}</Link>
      </p>
      <PurchaseRequestList items={items} emptyLabel={t('mineEmpty')} />

      <section className="cabinet-section cabinet-section--nested">
        <h2 className="section-title">{tn('myRequests')}</h2>
        <p className="page__subtitle">{tr('mineSubtitle')}</p>
        <RfqList items={rfqs} emptyLabel={tr('mineEmpty')} detailBasePath="/dashboard/rfqs" />
      </section>
    </main>
  );
}
