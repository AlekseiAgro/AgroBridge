import type { FarmDetail, RatingSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CertificateBadges } from '@/components/CertificateBadges';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { RatingStars } from '@/components/RatingStars';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { getProductCardImage } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
import { formatProductTitle } from '@/lib/product-title';
import { formatRegionLabel } from '@/lib/region';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function FarmDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('farm');
  const tc = await getTranslations('catalog');
  const tp = await getTranslations('product');
  const tProfile = await getTranslations('profile');
  const tr = await getTranslations();

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
        <h1 className="farm-title-row">
          {farm.name}
          <VerifiedBadge verified={farm.verified} />
        </h1>
        <p className="page__subtitle">
          {formatRegionLabel(farm.region, tr) || t('regionUnknown')}
          {' · '}
          <Link href={`/users/${farm.owner.id}`} className="profile-link">
            {farm.owner.displayName || tProfile('viewProfile')}
          </Link>
        </p>
        <div className="farm-rating">
          <RatingStars value={ownerRating.average} count={ownerRating.count} size="sm" />
        </div>
        {farm.description ? <p className="detail-text">{farm.description}</p> : null}

        <h2 className="section-title">{t('productsHeading')}</h2>
        {farm.products.length === 0 ? (
          <p className="empty-state">{t('noProducts')}</p>
        ) : (
          <ul className="product-list">
            {farm.products.map((product) => {
              const image = getProductCardImage(product);
              const quantity = formatProductQuantityRange(
                product,
                product.unit ? tp(`units.${product.unit as 'kg'}`) : null,
              );
              return (
                <li key={product.id} className="product-list__item product-list__item--with-media">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.url} alt="" className="product-list__media" />
                  ) : (
                    <div className="product-list__media product-list__media--empty" aria-hidden />
                  )}
                  <div>
                    <Link href={`/products/${product.id}`} className="product-list__title">
                      {formatProductTitle(product.title, locale)}
                    </Link>
                    <p className="product-list__meta">
                      {product.category
                        ? tc(`categories.${product.category as 'fruits'}`)
                        : tc('allCategories')}
                      {quantity ? ` · ${quantity}` : ''}
                    </p>
                    <div className="product-quality-summary">
                      <QualityScoreChip score={product.qualityScore} />
                      <CertificateBadges badges={product.certificateBadges} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
