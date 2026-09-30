import { formatListedPrice, type ProductDetail } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import { CertificateBadges } from '@/components/CertificateBadges';
import { HarvestPlanSummary } from '@/components/HarvestPlanSummary';
import { HarvestStatusBadge } from '@/components/HarvestStatusBadge';
import { ProductPhotoPlaceholder } from '@/components/ProductPhotoPlaceholder';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { getRenderableProductImages, toPublicMediaUrl } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
import { formatProductDescription, formatProductTitle } from '@/lib/product-title';
import { formatRegionLabel } from '@/lib/region';

type Props = {
  product: ProductDetail;
  locale: string;
};

type Translate = Awaited<ReturnType<typeof getTranslations<'product'>>>;

function attributeLabel(t: Translate, key: string): string {
  const path = `attributes.${key}` as Parameters<Translate>[0];
  return t.has(path) ? t(path) : key;
}

function attributeValue(t: Translate, value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return t(value ? 'yes' : 'no');
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const path = `attributeOptions.${value}` as Parameters<Translate>[0];
    return t.has(path) ? t(path) : value;
  }
  return JSON.stringify(value);
}

function specificationEntries(
  t: Translate,
  attributes: Record<string, unknown>,
): Array<[string, string]> {
  return Object.entries(attributes)
    .map(([key, value]) => {
      const formatted = attributeValue(t, value);
      if (formatted == null) return null;
      return [attributeLabel(t, key), formatted] as [string, string];
    })
    .filter((entry): entry is [string, string] => entry !== null);
}

export async function ProductModerationPreview({ product, locale }: Props) {
  const t = await getTranslations('product');
  const tc = await getTranslations('catalog');
  const tRoot = await getTranslations();
  const galleryImages = getRenderableProductImages(product.images);
  const quantityLabel = formatProductQuantityRange(
    product,
    product.unit ? t(`units.${product.unit as 'kg'}`) : null,
  );
  const unitLabel = product.unit ? t(`units.${product.unit as 'kg'}`) : null;
  const listedPrice = formatListedPrice(product);
  const specs = specificationEntries(t, product.attributes);

  return (
    <div className="product-moderation-preview">
      <div className="product-detail-header">
        <div className="product-detail-header__main">
          <h2 className="farm-title-row">
            {formatProductTitle(product.title, locale)}
            <HarvestStatusBadge
              status={product.harvestStatus}
              preorderEnabled={product.preorderEnabled}
            />
          </h2>
          <p className="page__subtitle">
            {product.farm ? (
              <>
                {product.farm.name}
                <VerifiedBadge verified={product.farm.verified} />
                {product.farm.region
                  ? ` · ${formatRegionLabel(product.farm.region, tRoot) ?? product.farm.region}`
                  : ''}
              </>
            ) : (
              product.owner.displayName?.trim() || t('sellerFallback')
            )}
          </p>
          <div className="product-insight-row">
            <CertificateBadges badges={product.certificateBadges} />
            <QualityScoreChip score={product.qualityScore} showTier />
          </div>
        </div>
        {listedPrice ? (
          <div className="product-detail-header__actions">
            <div className="product-detail-cta-price">
              <p className="product-detail-cta-price__label">{t('priceFrom')}</p>
              <p className="product-detail-cta-price__value">{listedPrice}</p>
            </div>
          </div>
        ) : null}
      </div>

      {galleryImages.length > 0 ? (
        <div className="product-gallery">
          {galleryImages.map((image) => (
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
      ) : (
        <div className="product-gallery">
          <ProductPhotoPlaceholder
            label={tc('noProductPhoto')}
            alt={tc('noProductPhotoAlt')}
            className="product-gallery__image product-gallery__image--primary"
          />
        </div>
      )}

      <div className="product-detail-sections">
        <section className="product-detail-section">
          <h3 className="section-title">{t('sections.basics')}</h3>
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
            <p className="detail-text">{formatProductDescription(product.description, locale)}</p>
          ) : null}
        </section>

        {product.priceFrom != null || product.priceNegotiable || product.priceDependsOnVolume ? (
          <section className="product-detail-section">
            <h3 className="section-title">{t('sections.pricing')}</h3>
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
          <h3 className="section-title">{t('sections.volume')}</h3>
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
            <h3 className="section-title">{t('sections.packaging')}</h3>
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
            <h3 className="section-title">{t('sections.logistics')}</h3>
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

        {specs.length ? (
          <section className="product-detail-section">
            <h3 className="section-title">{t('sections.attributes')}</h3>
            <dl className="account-details product-detail-grid">
              {specs.map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
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
            <h3 className="section-title">{t('sections.farmStory')}</h3>
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
                      : product.farm.ownershipType}
                  </dd>
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

        {product.certificates.length ? (
          <section className="product-detail-section">
            <h3 className="section-title">{t('certificates.title')}</h3>
            <ul className="product-list">
              {product.certificates.map((certificate) => (
                <li key={certificate.id} className="product-list__item">
                  <p className="product-list__title">{certificate.title}</p>
                  <p className="product-list__meta">
                    {certificate.type}
                    {certificate.reviewStatus ? ` · ${certificate.reviewStatus}` : ''}
                  </p>
                </li>
              ))}
            </ul>
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
    </div>
  );
}
