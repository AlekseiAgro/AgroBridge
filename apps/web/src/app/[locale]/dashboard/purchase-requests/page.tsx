import type { PurchaseRequestSummary, RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PurchaseRequestList } from '@/components/PurchaseRequestList';
import { EmptyState } from '@/components/EmptyState';
import { MarkSectionNotificationsRead } from '@/components/MarkSectionNotificationsRead';
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
  const tr = await getTranslations('rfq');
  const [items, rfqs] = await Promise.all([
    apiRequestAuthed<PurchaseRequestSummary[]>('/purchase-requests/mine'),
    apiRequestAuthed<RfqSummary[]>('/rfqs/mine'),
  ]);

  return (
    <main className="cabinet-page">
      <MarkSectionNotificationsRead section="purchase-requests" />
      <div className="page__heading-row">
        <div>
          <h1>{t('mineTitle')}</h1>
          <p className="page__subtitle">{t('mineSubtitle')}</p>
        </div>
        <Link href="/requests/new" className="button button--primary">
          {t('createCta')}
        </Link>
      </div>
      <PurchaseRequestList
        items={items}
        empty={
          <EmptyState
            title={t('mineEmptyTitle')}
            body={t('mineEmpty')}
            actions={
              <>
                <Link href="/requests/new" className="button button--primary">
                  {t('createCta')}
                </Link>
                <Link href="/requests" className="button button--ghost">
                  {t('boardTitle')}
                </Link>
              </>
            }
          />
        }
      />

      <section id="my-requests" className="cabinet-section cabinet-section--nested">
        <div className="page__heading-row">
          <div>
            <h2 className="section-title">{t('productRfqsLink')}</h2>
            <p className="page__subtitle">{tr('mineSubtitle')}</p>
          </div>
          <Link href="/catalog" className="button button--ghost">
            {tr('browseCatalog')}
          </Link>
        </div>
        <RfqList items={rfqs} emptyLabel={tr('mineEmpty')} detailBasePath="/dashboard/rfqs" />
      </section>
    </main>
  );
}
