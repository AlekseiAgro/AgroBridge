import type { ProductDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CertificateBadges } from '@/components/CertificateBadges';
import { HarvestPlanSummary } from '@/components/HarvestPlanSummary';
import { HarvestStatusBadge } from '@/components/HarvestStatusBadge';
import { HarvestWatchButton } from '@/components/HarvestWatchButton';
import { MarketInsightButton } from '@/components/MarketInsightButton';
import { MarketOpportunityBadge } from '@/components/MarketOpportunityBadge';
import { ProductQualityWidget } from '@/components/ProductQualityWidget';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { RatingStars } from '@/components/RatingStars';
import { RfqRequestForm } from '@/components/RfqRequestForm';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';
import { getProductCardImage, toPublicMediaUrl } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
import { formatProductDescription, formatProductTitle } from '@/lib/product-title';
import { formatRegionLabel } from '@/lib/region';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('product');
  const tc = await getTranslations('catalog');
  const th = await getTranslations('harvest');
  const tr = await getTranslations('rfq');
  const tRoot = await getTranslations();
  const token = await getAuthToken();
  const user = await getCurrentUser();

  let product: ProductDetail;
  try {
    product = await apiRequest<ProductDetail>(`/products/${id}`, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const fallbackImage = product.images.length === 0 ? getProductCardImage(product) : null;
  const quantityLabel = formatProductQuantityRange(
    product,
    product.unit ? t(`units.${product.unit as 'kg'}`) : null,
  );
  const unitLabel = product.unit ? t(`units.${product.unit as 'kg'}`) : null;
  const canRequest = Boolean(user);
  const showPreorder =
    product.preorderEnabled &&
    (product.harvestStatus === 'growing' ||
      product.harvestStatus === 'limited' ||
      product.harvestStatus === null);

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <p className="eyebrow">
          <Link href="/catalog">{tc('title')}</Link>
        </p>
        <h1 className="farm-title-row">
          {formatProductTitle(product.title, locale)}
          <HarvestStatusBadge
            status={product.harvestStatus}
            preorderEnabled={product.preorderEnabled}
          />
        </h1>
        <div className="product-opportunity-row">
          <MarketOpportunityBadge opportunity={product.opportunity} />
        </div>
        <p className="page__subtitle">
          {product.farm ? (
            <>
              <Link href={`/farms/${product.farm.id}`}>{product.farm.name}</Link>
              <VerifiedBadge verified={product.farm.verified} />
              {product.farm.region
                ? ` · ${formatRegionLabel(product.farm.region, tRoot) ?? product.farm.region}`
                : ''}
            </>
          ) : (
            <Link href={`/users/${product.owner.id}`}>
              {product.owner.displayName?.trim() || t('sellerFallback')}
            </Link>
          )}
        </p>
        <div className="product-list__rating product-list__rating--detail">
          <span className="product-list__rating-label">{tc('sellerRating')}</span>
          <RatingStars
            value={product.sellerRating?.average ?? null}
            count={product.sellerRating?.count ?? 0}
            size="sm"
          />
        </div>
        <div className="product-insight-row">
          <CertificateBadges badges={product.certificateBadges} />
          <MarketInsightButton productId={product.id} />
        </div>
        {product.images.length > 0 ? (
          <div className="product-gallery">
            {product.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={toPublicMediaUrl(image.url)}
                alt={formatProductTitle(product.title, locale)}
                className={
                  image.isPrimary
                    ? 'product-gallery__image product-gallery__image--primary'
                    : 'product-gallery__image'
                }
              />
            ))}
          </div>
        ) : fallbackImage ? (
          <div className="product-gallery">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fallbackImage.url}
              alt={formatProductTitle(product.title, locale)}
              className="product-gallery__image product-gallery__image--primary"
            />
          </div>
        ) : null}

        {product.isOwner ? (
          <ProductQualityWidget score={product.qualityScore} showGuidance />
        ) : (
          <div className="product-quality-summary product-quality-summary--detail">
            <QualityScoreChip score={product.qualityScore} showTier />
          </div>
        )}

        <div className="product-detail-sections">
          <section className="product-detail-section">
            <h2 className="section-title">{t('sections.basics')}</h2>
            <dl className="account-details product-detail-grid">
              {product.category ? (
                <div>
                  <dt>{t('category')}</dt>
                  <dd>{tc(`categories.${product.category as 'fruits'}`)}</dd>
                </div>
              ) : null}
              {product.variety ? (
                <div>
                  <dt>{t('variety')}</dt>
                  <dd>{product.variety}</dd>
                </div>
              ) : null}
              {product.country ? (
                <div>
                  <dt>{t('country')}</dt>
                  <dd>{product.country}</dd>
                </div>
              ) : null}
              {product.originPlace ? (
                <div>
                  <dt>{t('originPlace')}</dt>
                  <dd>{product.originPlace}</dd>
                </div>
              ) : null}
              {product.unit ? (
                <div>
                  <dt>{t('unit')}</dt>
                  <dd>{t(`units.${product.unit as 'kg'}`)}</dd>
                </div>
              ) : null}
            </dl>
            {product.description ? (
              <p className="detail-text">
                {formatProductDescription(product.description, locale)}
              </p>
            ) : null}
          </section>

          <section className="product-detail-section">
            <h2 className="section-title">{t('sections.volume')}</h2>
            <dl className="account-details product-detail-grid">
              {quantityLabel ? (
                <div>
                  <dt>{t('availableQuantity')}</dt>
                  <dd>{quantityLabel}</dd>
                </div>
              ) : null}
              {product.currentStock != null ? (
                <div>
                  <dt>{t('currentStock')}</dt>
                  <dd>
                    {product.currentStock} {unitLabel}
                  </dd>
                </div>
              ) : null}
              {product.monthlyProduction != null ? (
                <div>
                  <dt>{t('monthlyProduction')}</dt>
                  <dd>
                    {product.monthlyProduction} {unitLabel}
                  </dd>
                </div>
              ) : null}
              {product.maxAnnualProduction != null ? (
                <div>
                  <dt>{t('maxAnnualProduction')}</dt>
                  <dd>
                    {product.maxAnnualProduction} {unitLabel}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {Object.keys(product.attributes).length ? (
            <section className="product-detail-section">
              <h2 className="section-title">{t('sections.attributes')}</h2>
              <dl className="account-details product-detail-grid">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div key={key}>
                    <dt>{t(`attributes.${key}`)}</dt>
                    <dd>{typeof value === 'boolean' ? t(value ? 'yes' : 'no') : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {product.packagingTypes.length ||
          product.packagingWeights.length ||
          product.palletSize ? (
            <section className="product-detail-section">
              <h2 className="section-title">{t('sections.packaging')}</h2>
              <dl className="account-details product-detail-grid">
                {product.packagingTypes.length ? (
                  <div>
                    <dt>{t('packagingTypesLabel')}</dt>
                    <dd>
                      {product.packagingTypes.map((type) => t(`packagingTypes.${type}`)).join(', ')}
                    </dd>
                  </div>
                ) : null}
                {product.packagingWeights.length ? (
                  <div>
                    <dt>{t('packagingWeights')}</dt>
                    <dd>{product.packagingWeights.join(', ')}</dd>
                  </div>
                ) : null}
                {product.palletSize ? (
                  <div>
                    <dt>{t('palletSize')}</dt>
                    <dd>{product.palletSize}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {product.incoterms.length ||
          product.carriers.length ||
          product.customDelivery ||
          product.nearestPort ||
          product.deliveryAvailable ||
          product.leadTimeDays != null ? (
            <section className="product-detail-section">
              <h2 className="section-title">{t('sections.logistics')}</h2>
              <dl className="account-details product-detail-grid">
                {product.incoterms.length ? (
                  <div>
                    <dt>{t('incoterms')}</dt>
                    <dd>{product.incoterms.join(', ')}</dd>
                  </div>
                ) : null}
                {product.carriers.length ? (
                  <div>
                    <dt>{t('carriers')}</dt>
                    <dd>{product.carriers.join(', ')}</dd>
                  </div>
                ) : null}
                {product.nearestPort ? (
                  <div>
                    <dt>{t('nearestPort')}</dt>
                    <dd>{product.nearestPort}</dd>
                  </div>
                ) : null}
                {product.leadTimeDays != null ? (
                  <div>
                    <dt>{t('leadTimeDays')}</dt>
                    <dd>{t('daysValue', { count: product.leadTimeDays })}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t('deliveryAvailableLabel')}</dt>
                  <dd>{t(product.deliveryAvailable ? 'yes' : 'no')}</dd>
                </div>
                {product.customDelivery ? (
                  <div>
                    <dt>{t('customDelivery')}</dt>
                    <dd>{product.customDelivery}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {product.priceFrom != null || product.priceNegotiable || product.priceDependsOnVolume ? (
            <section className="product-detail-section">
              <h2 className="section-title">{t('sections.pricing')}</h2>
              <dl className="account-details product-detail-grid">
                {product.priceFrom != null ? (
                  <div>
                    <dt>{t('priceFrom')}</dt>
                    <dd>
                      {product.priceFrom} {product.priceCurrency}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>{t('priceNegotiable')}</dt>
                  <dd>{t(product.priceNegotiable ? 'yes' : 'no')}</dd>
                </div>
                <div>
                  <dt>{t('priceDependsOnVolume')}</dt>
                  <dd>{t(product.priceDependsOnVolume ? 'yes' : 'no')}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {product.farm &&
          (product.farm.foundedYear ||
            product.farm.farmSizeHectares != null ||
            product.farm.ownershipType ||
            product.farm.exportMarkets.length ||
            product.farm.history) ? (
            <section className="product-detail-section">
              <h2 className="section-title">{t('sections.farmStory')}</h2>
              <dl className="account-details product-detail-grid">
                {product.farm.foundedYear ? (
                  <div>
                    <dt>{t('farmFoundedYear')}</dt>
                    <dd>{product.farm.foundedYear}</dd>
                  </div>
                ) : null}
                {product.farm.farmSizeHectares != null ? (
                  <div>
                    <dt>{t('farmSize')}</dt>
                    <dd>{t('hectaresValue', { count: product.farm.farmSizeHectares })}</dd>
                  </div>
                ) : null}
                {product.farm.ownershipType ? (
                  <div>
                    <dt>{t('ownershipType')}</dt>
                    <dd>{product.farm.ownershipType}</dd>
                  </div>
                ) : null}
                {product.farm.exportMarkets.length ? (
                  <div>
                    <dt>{t('exportMarkets')}</dt>
                    <dd>{product.farm.exportMarkets.join(', ')}</dd>
                  </div>
                ) : null}
              </dl>
              {product.farm.history ? <p className="detail-text">{product.farm.history}</p> : null}
            </section>
          ) : null}
        </div>

        {product.videos.length ? (
          <section className="product-detail-section">
            <h2 className="section-title">{t('videos.publicTitle')}</h2>
            <div className="product-video-grid">
              {product.videos.map((video) => (
                <video key={video.id} controls preload="metadata">
                  <source src={toPublicMediaUrl(video.url)} type={video.mimeType} />
                </video>
              ))}
            </div>
          </section>
        ) : null}

        <HarvestPlanSummary
          locale={locale}
          seasonMonths={product.seasonMonths}
          harvestStartAt={product.harvestStartAt}
          harvestEndAt={product.harvestEndAt}
          forecastQuantity={product.forecastQuantity}
          harvestStatus={product.harvestStatus}
          preorderEnabled={product.preorderEnabled}
          unitLabel={unitLabel}
        />

        <section className="harvest-watch-section">
          <h2 className="section-title">{th('alertsTitle')}</h2>
          <p className="page__subtitle">{th('alertsSubtitle')}</p>
          <HarvestWatchButton
            productId={product.id}
            initialWatching={Boolean(product.watching)}
            isLoggedIn={Boolean(user)}
          />
        </section>

        {canRequest ? (
          <div style={{ marginTop: '1.75rem' }}>
            <RfqRequestForm
              productId={product.id}
              defaultUnit={product.unit}
              preorder={showPreorder}
            />
          </div>
        ) : !user ? (
          <div className="product-login-cta">
            <Link href="/login" className="button button--primary">
              {tr('loginToRequest')}
            </Link>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
