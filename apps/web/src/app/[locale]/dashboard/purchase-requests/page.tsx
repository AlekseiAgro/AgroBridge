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
  let items: PurchaseRequestSummary[] = [];
  let rfqs: RfqSummary[] = [];
  let loadError: string | null = null;
  try {
    [items, rfqs] = await Promise.all([
      apiRequestAuthed<PurchaseRequestSummary[]>('/purchase-requests/mine'),
      apiRequestAuthed<RfqSummary[]>('/rfqs/mine'),
    ]);
  } catch {
    loadError = t('loadError');
  }

  return (
    <main className="cabinet-page">
      {loadError ? null : <MarkSectionNotificationsRead section="purchase-requests" />}
      <div className="page__heading-row">
        <div>
          <h1>{t('mineTitle')}</h1>
          <p className="page__subtitle">{t('mineSubtitle')}</p>
        </div>
        <Link href="/requests/new" className="button button--primary">
          {t('createCta')}
        </Link>
      </div>
      {loadError ? (
        <p className="form-error">{loadError}</p>
      ) : (
      <>
      <PurchaseRequestList
        items={items}
        variant="mine"
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
      </>
      )}
    </main>
  );
}
