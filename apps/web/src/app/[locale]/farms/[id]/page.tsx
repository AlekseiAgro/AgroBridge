import type { FarmDetail, RatingSummary } from '@agrobridge/shared';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FarmProfileView } from '@/components/FarmProfileView';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { ApiError, apiRequest } from '@/lib/api';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function FarmDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  let farm: FarmDetail;
  try {
    farm = await apiRequest<FarmDetail>(`/farms/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  let ownerRating: RatingSummary = { average: null, count: 0 };
  try {
    ownerRating = await apiRequest<RatingSummary>(`/users/${farm.owner.id}/rating`);
  } catch {
    ownerRating = { average: null, count: 0 };
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <FarmProfileView farm={farm} locale={locale} ownerRating={ownerRating} />
      </main>
      <SiteFooter />
    </div>
  );
}
