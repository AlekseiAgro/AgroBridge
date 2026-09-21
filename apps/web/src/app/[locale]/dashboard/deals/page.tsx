import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CompletedDealsList } from '@/components/CompletedDealsList';
import { Link } from '@/i18n/navigation';
import { filterRfqsForCabinet } from '@/lib/rfq-cabinet-filters';
import { requireVerifiedUser } from '@/lib/require-verified-user';
import { apiRequestAuthed } from '@/lib/server-api';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ needsRating?: string }>;
};

export default async function CompletedDealsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const user = await requireVerifiedUser(locale, '/dashboard/deals');
  const t = await getTranslations('cabinet');
  const items = filterRfqsForCabinet(
    await apiRequestAuthed<RfqSummary[]>('/rfqs/completed'),
    query,
  );

  return (
    <main className="cabinet-page">
      <p className="eyebrow">
        <Link href="/account">{t('overview')}</Link>
      </p>
      <h1>{t('deals.title')}</h1>
      <p className="page__subtitle">{t('deals.subtitle')}</p>
      <CompletedDealsList
        items={items}
        viewerId={user.id}
        emptyLabel={t('deals.empty')}
      />
    </main>
  );
}
