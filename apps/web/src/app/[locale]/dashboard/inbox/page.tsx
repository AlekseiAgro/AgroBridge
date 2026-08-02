import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RfqList } from '@/components/RfqList';
import { redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FarmerInboxPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'farmer' && user!.role !== 'admin') {
    redirect({ href: '/account', locale });
  }

  const t = await getTranslations('rfq');
  const items = await apiRequestAuthed<RfqSummary[]>('/rfqs/inbox');

  return (
    <main className="cabinet-page">
        <h1>{t('inboxTitle')}</h1>
        <p className="page__subtitle">{t('inboxSubtitle')}</p>
        <RfqList items={items} emptyLabel={t('inboxEmpty')} detailBasePath="/dashboard/inbox" />
    </main>
  );
}
