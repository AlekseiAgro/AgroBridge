import type { PurchaseRequestSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PurchaseRequestFilters } from '@/components/PurchaseRequestFilters';
import { PurchaseRequestList } from '@/components/PurchaseRequestList';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function PurchaseRequestsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('purchaseRequests');
  const user = await getCurrentUser();
  const token = await getAuthToken();

  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.category) query.set('category', filters.category);

  let items: PurchaseRequestSummary[] = [];
  let loadError: string | null = null;
  try {
    const path = query.toString()
      ? `/purchase-requests?${query.toString()}`
      : '/purchase-requests';
    items = await apiRequest<PurchaseRequestSummary[]>(path, { token });
  } catch {
    loadError = t('loadError');
  }

  const canCreate = user?.role === 'buyer' || user?.role === 'admin';

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <div className="page__heading-row">
          <div>
            <h1>{t('boardTitle')}</h1>
            <p className="page__subtitle">{t('boardSubtitle')}</p>
          </div>
          {canCreate ? (
            <Link href="/requests/new" className="button button--primary">
              {t('createCta')}
            </Link>
          ) : !user ? (
            <Link href="/login" className="button button--primary">
              {t('loginToCreate')}
            </Link>
          ) : null}
        </div>

        <PurchaseRequestFilters initialQ={filters.q} initialCategory={filters.category} />

        {loadError ? <p className="form-error">{loadError}</p> : null}

        {!loadError ? (
          <PurchaseRequestList items={items} emptyLabel={t('boardEmpty')} />
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
