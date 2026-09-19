import type { PurchaseQuoteMineItem } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PurchaseQuoteList } from '@/components/PurchaseQuoteList';
import { Link, redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MyQuotesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });

  const t = await getTranslations('purchaseRequests');
  let items: PurchaseQuoteMineItem[] = [];
  let loadError: string | null = null;
  try {
    items = await apiRequestAuthed<PurchaseQuoteMineItem[]>('/purchase-requests/my-quotes');
  } catch {
    loadError = t('myQuotesLoadError');
  }

  return (
    <main className="cabinet-page">
      <div className="page__heading-row">
        <div>
          <h1>{t('myQuotesTitle')}</h1>
          <p className="page__subtitle">{t('myQuotesSubtitle')}</p>
        </div>
        <Link href="/requests" className="button button--ghost">
          {t('boardTitle')}
        </Link>
      </div>
      <p className="eyebrow">
        <Link href="/requests">{t('boardTitle')}</Link>
        {' · '}
        <Link href="/dashboard/purchase-requests">{t('mineTitle')}</Link>
      </p>
      {loadError ? <p className="form-error">{loadError}</p> : null}
      <PurchaseQuoteList items={items} emptyLabel={t('myQuotesEmpty')} />
    </main>
  );
}
