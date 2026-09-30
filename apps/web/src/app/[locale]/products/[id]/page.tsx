import {
  formatListedPrice,
  isPubliclyListedProduct,
  LOCALE_ENDONYM,
  type ProductDetail,
} from '@agrobridge/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CertificateBadges } from '@/components/CertificateBadges';
import { HarvestPlanSummary } from '@/components/HarvestPlanSummary';
import { HarvestStatusBadge } from '@/components/HarvestStatusBadge';
import { HarvestWatchButton } from '@/components/HarvestWatchButton';
import { RecordProductView } from '@/components/RecordProductView';
import { MarketInsightButton } from '@/components/MarketInsightButton';
import { MarketOpportunityBadge } from '@/components/MarketOpportunityBadge';
import { FarmLink } from '@/components/FarmLink';
import { OriginalText, OriginalToggleButton, OriginalToggleFrame } from '@/components/OriginalToggle';
import { OpenChatButton } from '@/components/OpenChatButton';
import { ProductQualityWidget } from '@/components/ProductQualityWidget';
import { JsonLd } from '@/components/JsonLd';
import { PublicBreadcrumbs } from '@/components/PublicBreadcrumbs';
import { ProductPhotoPlaceholder } from '@/components/ProductPhotoPlaceholder';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { RatingStars } from '@/components/RatingStars';
import { RfqRequestForm } from '@/components/RfqRequestForm';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';
import { getRenderableProductImages, toPublicMediaUrl } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
import { catalogCopyDiffers, catalogDisplayDescription, catalogDisplayTitle } from '@/lib/catalog-display';
import { formatRegionLabel } from '@/lib/region';
import { verifyEmailRedirectHref } from '@/lib/protected-next-path';
import { buildBreadcrumbJsonLd, buildProductJsonLd } from '@/lib/seo-jsonld';
import { productPageMetadata } from '@/lib/seo-public-metadata';
import { getCurrentUser } from '@/lib/session';

const loadProduct = cache(async (id: string, token: string | null, locale: string) => {
  return apiRequest<ProductDetail>(`/products/${id}?locale=${encodeURIComponent(locale)}`, {
    token,
  });
});

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  try {
    const product = await loadProduct(id, await getAuthToken(), locale);
    return productPageMetadata(product, locale);
  } catch {
    return {};
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('product');
  const tc = await getTranslations('catalog');
  const tBreadcrumbs = await getTranslations('breadcrumbs');
  const th = await getTranslations('harvest');
  const tr = await getTranslations('rfq');
  const tVerify = await getTranslations('verifyEmail');
  const tRoot = await getTranslations();
  const token = await getAuthToken();
  const user = await getCurrentUser();

  let product: ProductDetail;
  try {
    product = await loadProduct(id, token, locale);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const galleryImages = getRenderableProductImages(product.images);
  const quantityLabel = formatProductQuantityRange(
    product,
    product.unit ? t(`units.${product.unit as 'kg'}`) : null,
  );
  const unitLabel = product.unit ? t(`units.${product.unit as 'kg'}`) : null;
  const listedPrice = formatListedPrice(product);
  const needsEmailVerification = Boolean(user && !user.emailVerified);
  const canRequest = Boolean(user?.emailVerified) && !product.isOwner;
  const productPath = `/products/${product.id}`;
  const verifyProductHref = verifyEmailRedirectHref(productPath);
  const verifyRequestHref = verifyEmailRedirectHref(`${productPath}#request-quote`);
  const verifyWatchHref = verifyEmailRedirectHref(`${productPath}#harvest-alerts`);
  const productName = catalogDisplayTitle(product);
  const sourceLocale = product.source?.locale;
  const originalLanguage = sourceLocale ? LOCALE_ENDONYM[sourceLocale] : sourceLocale;
  const productJsonLd = buildProductJsonLd(product, locale);
  const breadcrumbJsonLd = isPubliclyListedProduct(product)
    ? buildBreadcrumbJsonLd({
        locale,
        idPath: `/products/${product.id}`,
        items: [
          { name: tBreadcrumbs('home'), path: '' },
          { name: tBreadcrumbs('catalog'), path: '/catalog' },
          { name: productName, path: `/products/${product.id}` },
        ],
      })
    : null;
  const soldOut = product.harvestStatus === 'soldOut';
  const showPreorder =
    product.preorderEnabled &&
    (product.harvestStatus === 'growing' ||
      product.harvestStatus === 'limited' ||
      product.harvestStatus === null);

  return (
    <div className="page">
      {productJsonLd ? <JsonLd data={productJsonLd} /> : null}
      {breadcrumbJsonLd ? <JsonLd data={breadcrumbJsonLd} /> : null}
      <SiteHeader />
      <RecordProductView productId={product.id} isOwner={Boolean(product.isOwner)} />
      <main className="page__main">
        <OriginalToggleFrame
          differs={
            catalogCopyDiffers(product) ||
            Boolean(
              product.farm?.source &&
                product.farm.display &&
                (                  product.farm.source.history !== product.farm.display.history ||
                  product.farm.source.exportMarkets.join('\n') !==
                    product.farm.display.exportMarkets.join('\n')),
            )
          }
        >
        <div className="product-detail-header">
          <div className="product-detail-header__main">
            <PublicBreadcrumbs
              ariaLabel={tBreadcrumbs('label')}
              items={[
                { href: '/', label: tBreadcrumbs('home') },
                { href: '/catalog', label: tBreadcrumbs('catalog') },
              ]}
              current={productName}
            />
            <h1 className="farm-title-row">
              <OriginalText
                display={productName}
                source={product.source?.title ?? product.title}
              />
              <HarvestStatusBadge
                status={product.harvestStatus}
                preorderEnabled={product.preorderEnabled}
              />
            </h1>
            <OriginalToggleButton
              showOriginalLabel={tc('showOriginal')}
              showTranslationLabel={tc('showTranslation')}
              originalLanguageLabel={tc('originalLanguage', { language: originalLanguage ?? '' })}
            />
            <div className="product-opportunity-row">
              <MarketOpportunityBadge opportunity={product.opportunity} />
            </div>
            <FarmLink
              href={product.farm ? `/farms/${product.farm.id}` : `/users/${product.owner.id}`}
              name={
                product.farm?.name || product.owner.displayName?.trim() || t('sellerFallback')
              }
              place={
                [
                  product.farm?.region
                    ? formatRegionLabel(product.farm.region, tRoot) ?? product.farm.region
                    : null,
                  product.country,
                ]
                  .filter(Boolean)
                  .join(', ') || null
              }
              badge={
                product.farm ? <VerifiedBadge verified={product.farm.verified} /> : undefined
              }
            />
            <div className="product-list__rating product-list__rating--detail">
              <span className="product-list__rating-label">{tc('sellerRating')}</span>
              <RatingStars
                value={product.sellerRating?.average ?? null}
                count={product.sellerRating?.count ?? 0}
                size="sm"
                reviewsHref={`/users/${product.owner.id}/reviews`}
              />
            </div>
            <div className="product-insight-row">
              <CertificateBadges badges={product.certificateBadges} />
              <MarketInsightButton productId={product.id} />
            </div>
          </div>
          {!product.isOwner ? (
            <div className="product-detail-header__actions">
              {listedPrice ? (
                <div className="product-detail-cta-price">
                  <p className="product-detail-cta-price__label">{t('priceFrom')}</p>
                  <p className="product-detail-cta-price__value">{listedPrice}</p>
                </div>
              ) : null}
              {soldOut ? (
                needsEmailVerification ? (
                  <Link href={verifyWatchHref} className="button button--ghost">
                    {tVerify('confirm')}
                  </Link>
                ) : (
                  <a href="#harvest-alerts" className="button button--ghost">
                    {th('notifyWhenAvailable')}
                  </a>
                )
              ) : needsEmailVerification ? (
                <Link href={verifyRequestHref} className="button button--primary">
                  {tVerify('confirm')}
                </Link>
              ) : (
                <a href="#request-quote" className="button button--primary">
                  {tr('submitRequest')}
                </a>
              )}
              {needsEmailVerification ? (
                <Link href={verifyProductHref} className="button button--ghost">
                  {tVerify('confirm')}
                </Link>
              ) : user ? (
                <OpenChatButton
                  farmerId={product.ownerUserId}
                  label={t('messageSeller')}
                  variant="ghost"
                />
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`}
                  className="button button--ghost"
                >
                  {t('messageSeller')}
                </Link>
              )}
            </div>
          ) : null}
        </div>
        {galleryImages.length > 0 ? (
          <div className="product-gallery">
            {galleryImages.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={image.url}
                alt={productName}
                className={
                  image.isPrimary
                    ? 'product-gallery__image product-gallery__image--primary'
                    : 'product-gallery__image'
                }
              />
            ))}
          </div>
        ) : (
          <div className="product-gallery">
            <ProductPhotoPlaceholder
              label={tc('noProductPhoto')}
              alt={tc('noProductPhotoAlt')}
              className="product-gallery__image product-gallery__image--primary"
            />
          </div>
        )}

        {product.isOwner ? (
          <ProductQualityWidget score={product.qualityScore} showGuidance />
        ) : null}

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
              {product.display?.variety || product.variety ? (
                <div>
                  <dt>{t('variety')}</dt>
                  <dd>
                    <OriginalText
                      display={product.display?.variety ?? product.variety}
                      source={product.source?.variety ?? product.variety}
                    />
                  </dd>
                </div>
              ) : null}
              {product.country ? (
                <div>
                  <dt>{t('country')}</dt>
                  <dd>{product.country}</dd>
                </div>
              ) : null}
              {product.display?.originPlace || product.originPlace ? (
                <div>
                  <dt>{t('originPlace')}</dt>
                  <dd>
                    <OriginalText
                      display={product.display?.originPlace ?? product.originPlace}
                      source={product.source?.originPlace ?? product.originPlace}
                    />
                  </dd>
                </div>
              ) : null}
              {product.unit ? (
                <div>
                  <dt>{t('unit')}</dt>
                  <dd>{t(`units.${product.unit as 'kg'}`)}</dd>
                </div>
              ) : null}
            </dl>
            {catalogDisplayDescription(product) || product.description ? (
              <p className="detail-text">
                <OriginalText
                  display={catalogDisplayDescription(product)}
                  source={product.source?.description ?? product.description}
                />
              </p>
            ) : null}
          </section>

          {product.priceFrom != null || product.priceNegotiable || product.priceDependsOnVolume ? (
            <section className="product-detail-section">
              <h2 className="section-title">{t('sections.pricing')}</h2>
              <dl className="account-details product-detail-grid">
                {product.priceFrom != null ? (
                  <div className="product-detail-price-lead">
                    <dt>{t('priceFrom')}</dt>
                    <dd className="product-detail-price-lead__value">
                      {listedPrice ?? `${product.priceFrom} ${product.priceCurrency}`}
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

          {product.farm &&
          (product.farm.foundedYear ||
            product.farm.farmSizeHectares != null ||
            product.farm.producerType ||
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
                {product.farm.producerType || product.farm.ownershipType ? (
                  <div>
                    <dt>{t('producerType')}</dt>
                    <dd>
                      {product.farm.producerType
                        ? t(`producerTypes.${product.farm.producerType}`)
                        : (product.farm.source?.ownershipType ?? product.farm.ownershipType)}
                    </dd>
                  </div>
                ) : null}
                {(product.farm.display?.exportMarkets.length || product.farm.exportMarkets.length) ? (
                  <div>
                    <dt>{t('exportMarkets')}</dt>
                    <dd>
                      <OriginalText
                        display={(product.farm.display?.exportMarkets ?? product.farm.exportMarkets).join(', ')}
                        source={(product.farm.source?.exportMarkets ?? product.farm.exportMarkets).join(', ')}
                      />
                    </dd>
                  </div>
                ) : null}
              </dl>
              {product.farm.display?.history || product.farm.history ? (
                <p className="detail-text">
                  <OriginalText
                    display={product.farm.display?.history ?? product.farm.history}
                    source={product.farm.source?.history ?? product.farm.history}
                  />
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
        </OriginalToggleFrame>

        {!product.isOwner ? (
          <div className="product-quality-summary product-quality-summary--detail">
            <QualityScoreChip score={product.qualityScore} showTier />
          </div>
        ) : null}

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

        <section id="harvest-alerts" className="harvest-watch-section">
          <h2 className="section-title">{soldOut ? th('soldOutTitle') : th('alertsTitle')}</h2>
          <p className="page__subtitle">
            {soldOut ? th('soldOutSubtitle') : th('alertsSubtitle')}
          </p>
          <HarvestWatchButton
            productId={product.id}
            initialWatching={Boolean(product.watching)}
            isLoggedIn={Boolean(user)}
            isOwner={Boolean(product.isOwner)}
            unavailable={soldOut}
            verifyHref={needsEmailVerification ? verifyWatchHref : undefined}
          />
        </section>

        {soldOut ? null : canRequest ? (
          <div id="request-quote" className="product-request-anchor" style={{ marginTop: '1.75rem' }}>
            <RfqRequestForm
              productId={product.id}
              defaultUnit={product.unit}
              preorder={showPreorder}
            />
          </div>
        ) : needsEmailVerification && !product.isOwner ? (
          <div id="request-quote" className="product-login-cta product-request-anchor">
            <p className="page__subtitle">{tVerify('productGate')}</p>
            <Link href={verifyRequestHref} className="button button--primary">
              {tVerify('confirm')}
            </Link>
          </div>
        ) : !user ? (
          <div id="request-quote" className="product-login-cta product-request-anchor">
            <Link
              href={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`}
              className="button button--primary"
            >
              {tr('loginToRequest')}
            </Link>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
