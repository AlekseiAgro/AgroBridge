import type { FarmDetail, RatingSummary } from '@agrobridge/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { FarmProfileView } from '@/components/FarmProfileView';
import { JsonLd } from '@/components/JsonLd';
import { PublicBreadcrumbs } from '@/components/PublicBreadcrumbs';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { ApiError, apiRequest } from '@/lib/api';
import { buildBreadcrumbJsonLd } from '@/lib/seo-jsonld';
import { farmPageMetadata } from '@/lib/seo-public-metadata';

const loadFarm = cache(async (id: string) => apiRequest<FarmDetail>(`/farms/${id}`));

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  try {
    return farmPageMetadata(await loadFarm(id), locale);
  } catch {
    return {};
  }
}

export default async function FarmDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const tBreadcrumbs = await getTranslations('breadcrumbs');

  let farm: FarmDetail;
  try {
    farm = await loadFarm(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale,
    idPath: `/farms/${farm.id}`,
    items: [
      { name: tBreadcrumbs('home'), path: '' },
      { name: farm.name, path: `/farms/${farm.id}` },
    ],
  });

  let ownerRating: RatingSummary = { average: null, count: 0 };
  try {
    ownerRating = await apiRequest<RatingSummary>(`/users/${farm.owner.id}/rating`);
  } catch {
    ownerRating = { average: null, count: 0 };
  }

  return (
    <div className="page">
      {breadcrumbJsonLd ? <JsonLd data={breadcrumbJsonLd} /> : null}
      <SiteHeader />
      <main className="page__main">
        <PublicBreadcrumbs
          ariaLabel={tBreadcrumbs('label')}
          items={[{ href: '/', label: tBreadcrumbs('home') }]}
          current={farm.name}
        />
        <FarmProfileView farm={farm} locale={locale} ownerRating={ownerRating} />
      </main>
      <SiteFooter />
    </div>
  );
}
