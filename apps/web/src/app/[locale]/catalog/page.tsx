import { formatListedPrice, type ProductSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CertificateBadges } from '@/components/CertificateBadges';
import { CatalogFilters } from '@/components/CatalogFilters';
import { CatalogPurchaseCta } from '@/components/CatalogPurchaseCta';
import { HarvestStatusBadge } from '@/components/HarvestStatusBadge';
import { MarketOpportunityBadge } from '@/components/MarketOpportunityBadge';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { RatingStars } from '@/components/RatingStars';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { ProductPhotoPlaceholder } from '@/components/ProductPhotoPlaceholder';
import { EmptyState } from '@/components/EmptyState';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api';
import { getProductCardImage, getProductCardImageAlt } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
import { formatProductDescription, formatProductTitle } from '@/lib/product-title';
import { formatRegionLabel } from '@/lib/region';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    region?: string;
    harvestStatus?: string;
    preorder?: string;
    inSeason?: string;
  }>;
};

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('catalog');
  const tn = await getTranslations('nav');
  const tr = await getTranslations();
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.category) query.set('category', filters.category);
  if (filters.region) query.set('region', filters.region);
  if (filters.harvestStatus) query.set('harvestStatus', filters.harvestStatus);
  if (filters.preorder === 'true') query.set('preorder', 'true');
  if (filters.inSeason === 'true') query.set('inSeason', 'true');

  let products: ProductSummary[] = [];
  let loadError: string | null = null;
  try {
    const path = query.toString() ? `/products?${query.toString()}` : '/products';
    products = await apiRequest<ProductSummary[]>(path);
  } catch {
    loadError = t('loadError');
  }

  const hasFilters = query.toString().length > 0;

  return (
    <main className="page__main">
      <p className="eyebrow">
        <Link href="/buyers">{tn('forBuyers')}</Link>
      </p>
      <h1>{t('title')}</h1>
      <p className="page__subtitle">{t('subtitle')}</p>
      <CatalogFilters
        initialQ={filters.q}
        initialCategory={filters.category}
        initialRegion={filters.region}
        initialHarvestStatus={filters.harvestStatus}
        initialPreorder={filters.preorder === 'true'}
        initialInSeason={filters.inSeason === 'true'}
      />

      {loadError ? <p className="form-error">{loadError}</p> : null}

      {!loadError && products.length === 0 ? (
        <EmptyState
          title={hasFilters ? t('emptyFilteredTitle') : t('emptyTitle')}
          body={hasFilters ? t('empty') : t('emptyUnfiltered')}
          actions={
            <>
              {hasFilters ? (
                <Link href="/catalog" className="button button--ghost">
                  {t('emptyReset')}
                </Link>
              ) : null}
              <Link href="/requests/new" className="button button--primary">
                {t('floatingCta')}
              </Link>
            </>
          }
        />
      ) : (
        <ul className="product-list">
          {products.map((product) => {
            const image = getProductCardImage(product);
            const imageAlt = getProductCardImageAlt({
              hasProductPhoto: Boolean(image),
              productTitle: formatProductTitle(product.title, locale),
              noPhotoAlt: t('noProductPhotoAlt'),
            });
            const quantity = formatProductQuantityRange(
              product,
              product.unit ? tr(`product.units.${product.unit as 'kg'}`) : null,
            );
            const listedPrice = formatListedPrice(product);
            const rating = product.sellerRating;
            const sellerLabel =
              product.farm?.name ||
              product.owner.displayName?.trim() ||
              tr('product.sellerFallback');
            return (
              <li key={product.id} className="product-list__item product-list__item--with-media">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={imageAlt} className="product-list__media" />
                ) : (
                  <ProductPhotoPlaceholder
                    label={t('noProductPhoto')}
                    alt={imageAlt}
                    className="product-list__media"
                  />
                )}
                <div>
                  <Link href={`/products/${product.id}`} className="product-list__title">
                    {formatProductTitle(product.title, locale)}
                  </Link>
                  <p className="product-list__meta">
                    {product.farm ? (
                      <>
                        <Link href={`/farms/${product.farm.id}`}>{product.farm.name}</Link>
                        <VerifiedBadge verified={product.farm.verified} />
                        {product.farm.region
                          ? ` · ${formatRegionLabel(product.farm.region, tr) ?? product.farm.region}`
                          : ''}
                      </>
                    ) : (
                      <Link href={`/users/${product.owner.id}`}>{sellerLabel}</Link>
                    )}
                    {product.category
                      ? ` · ${t(`categories.${product.category as 'fruits'}`)}`
                      : ''}
                  </p>
                  <HarvestStatusBadge
                    status={product.harvestStatus}
                    preorderEnabled={product.preorderEnabled}
                  />
                  <p
                    className={`product-list__price${listedPrice ? '' : ' product-list__price--request'}`}
                  >
                    {listedPrice ?? t('priceOnRequest')}
                  </p>
                  <div className="product-opportunity-row">
                    <MarketOpportunityBadge opportunity={product.opportunity} />
                  </div>
                  <div className="product-quality-summary">
                    <QualityScoreChip score={product.qualityScore} showTier />
                    <CertificateBadges badges={product.certificateBadges} />
                  </div>
                  <div className="product-list__rating">
                    <span className="product-list__rating-label">{t('sellerRating')}</span>
                    <RatingStars
                      value={rating?.average ?? null}
                      count={rating?.count ?? 0}
                      size="sm"
                      reviewsHref={`/users/${product.owner.id}/reviews`}
                    />
                  </div>
                  {quantity ? (
                    <p className="product-list__meta">
                      {t('availableQuantity')}: {quantity}
                    </p>
                  ) : null}
                  {product.description ? (
                    <p className="product-list__desc">
                      {formatProductDescription(product.description, locale)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <CatalogPurchaseCta />
    </main>
  );
}
