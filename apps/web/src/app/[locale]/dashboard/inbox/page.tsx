import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RfqList } from '@/components/RfqList';
import { redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';
import { filterRfqsForCabinet } from '@/lib/rfq-cabinet-filters';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; needsRating?: string }>;
};

export default async function FarmerInboxPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });

  const t = await getTranslations('rfq');
  let items: RfqSummary[] = [];
  let loadError: string | null = null;
  try {
    items = filterRfqsForCabinet(
      await apiRequestAuthed<RfqSummary[]>('/rfqs/inbox'),
      query,
    );
  } catch {
    loadError = t('loadError');
  }

  return (
    <main className="cabinet-page">
        <h1>{t('inboxTitle')}</h1>
        <p className="page__subtitle">{t('inboxSubtitle')}</p>
        {loadError ? (
          <p className="form-error">{loadError}</p>
        ) : (
          <RfqList
            items={items}
            emptyLabel={t('inboxEmpty')}
            detailBasePath="/dashboard/inbox"
            allowDeleteCancelled
          />
        )}
    </main>
  );
}
