import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RfqList } from '@/components/RfqList';
import { SiteHeader } from '@/components/SiteHeader';
import { Link, redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function BuyerRfqsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'buyer' && user!.role !== 'admin') {
    redirect({ href: '/account', locale });
  }

  const t = await getTranslations('rfq');
  const items = await apiRequestAuthed<RfqSummary[]>('/rfqs/mine');

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <h1>{t('mineTitle')}</h1>
        <p className="page__subtitle">{t('mineSubtitle')}</p>
        <p className="eyebrow">
          <Link href="/catalog">{t('browseCatalog')}</Link>
        </p>
        <RfqList items={items} emptyLabel={t('mineEmpty')} detailBasePath="/dashboard/rfqs" />
      </main>
    </div>
  );
}
