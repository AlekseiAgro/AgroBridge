import { formatListedPrice, LOCALE_ENDONYM, type FarmDetail, type RatingSummary } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CertificateBadges } from '@/components/CertificateBadges';
import { FarmCoverPhotos } from '@/components/FarmCoverPhotos';
import { FarmPublicText } from '@/components/FarmPublicText';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { RatingStars } from '@/components/RatingStars';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Link } from '@/i18n/navigation';
import { ProductPhotoPlaceholder } from '@/components/ProductPhotoPlaceholder';
import { isPublicFarmProduct } from '@/lib/farm-profile';
import { getProductCardImage, getProductCardImageAlt } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
import { formatProductTitle } from '@/lib/product-title';
import { formatRegionLabel } from '@/lib/region';

type Props = {
  farm: FarmDetail;
  locale: string;
  ownerRating?: RatingSummary | null;
  /** Owner-only controls such as Edit. Omitted on the public farm page. */
  actions?: ReactNode;
  /** Public pages link to the producer's user profile; the owner dashboard does not. */
  showOwnerLink?: boolean;
};

/**
 * Shared farm profile presentation. Used by the public `/farms/:id` page and by the
 * owner's "My Farm" view so the two cannot drift.
 *
 * It only renders fields the public catalog already exposes. Callers must pass a
 * public-shaped `farm` (see `toPublicFarmProfile`); unpublished products are still
 * filtered here as a last line of defence.
 */
export async function FarmProfileView({
  farm,
  locale,
  ownerRating,
  actions,
  showOwnerLink = true,
}: Props) {
  const t = await getTranslations('farm');
  const tc = await getTranslations('catalog');
  const tp = await getTranslations('product');
  const tProfile = await getTranslations('profile');
  const tr = await getTranslations();

  const products = farm.products.filter(isPublicFarmProduct);
  const regionLabel = formatRegionLabel(farm.region, tr) || t('regionUnknown');
  const cover = farm.photos.find((photo) => photo.isPrimary) ?? farm.photos[0] ?? null;
  const extraPhotos = cover ? farm.photos.filter((photo) => photo.id !== cover.id) : [];
  const display = farm.display;
  const source = farm.source;
  const ownership = display?.ownershipType ?? farm.ownershipType;
  const markets = display?.exportMarkets ?? farm.exportMarkets;
  const history = display?.history ?? farm.history;
  const description = display?.description ?? farm.description;
  const hasAbout =
    Boolean(farm.foundedYear) ||
    farm.farmSizeHectares != null ||
    Boolean(ownership) ||
    markets.length > 0 ||
    Boolean(history) ||
    Boolean(description) ||
    Boolean(farm.companyRegistryName);
  const sourceLocale = source?.locale;
  const originalLanguage = sourceLocale ? LOCALE_ENDONYM[sourceLocale] : '';

  return (
    <article className="farm-profile">
      <header
        className={
          cover ? 'farm-profile__header farm-profile__header--with-cover' : 'farm-profile__header'
        }
      >
        {cover ? (
          <FarmCoverPhotos farmName={farm.name} cover={cover} extraPhotos={extraPhotos} />
        ) : null}
        <div className="farm-profile__identity">
          <div className="farm-profile__identity-top">
            <div>
              <h1 className="farm-title-row">
                {farm.name}
                <VerifiedBadge verified={farm.verified} />
              </h1>
              <p className="page__subtitle">
                {regionLabel}
                {showOwnerLink ? (
                  <>
                    {' · '}
                    <Link href={`/users/${farm.owner.id}`} className="profile-link">
                      {farm.owner.displayName || tProfile('viewProfile')}
                    </Link>
                  </>
                ) : null}
              </p>
              {ownerRating ? (
                <div className="farm-rating">
                  <RatingStars
                    value={ownerRating.average}
                    count={ownerRating.count}
                    size="sm"
                    reviewsHref={`/users/${farm.owner.id}/reviews`}
                  />
                </div>
              ) : null}
            </div>
            {actions ? <div className="farm-profile__actions">{actions}</div> : null}
          </div>
        </div>
      </header>

      {hasAbout ? (
        <section className="farm-profile__about" aria-labelledby="farm-about-heading">
          <h2 id="farm-about-heading" className="section-title">
            {t('aboutHeading')}
          </h2>
          <dl className="account-details product-detail-grid">
            {farm.foundedYear ? (
              <div>
                <dt>{t('foundedYear')}</dt>
                <dd>{farm.foundedYear}</dd>
              </div>
            ) : null}
            {farm.farmSizeHectares != null ? (
              <div>
                <dt>{t('size')}</dt>
                <dd>{t('hectaresValue', { count: farm.farmSizeHectares })}</dd>
              </div>
            ) : null}
          </dl>
          <FarmPublicText
            source={source ?? {
              locale: 'en',
              description: farm.description,
              history: farm.history,
              ownershipType: farm.ownershipType,
              exportMarkets: farm.exportMarkets,
            }}
            display={display}
            companyRegistryName={farm.companyRegistryName}
            labels={{
              ownershipType: t('ownershipType'),
              exportMarkets: t('exportMarkets'),
              registeredName: t('registeredName'),
              showOriginal: tc('showOriginal'),
              showTranslation: tc('showTranslation'),
              originalLanguage: tc('originalLanguage', { language: originalLanguage }),
            }}
          />
        </section>
      ) : null}

      <h2 className="section-title">{t('productsHeading')}</h2>
      {products.length === 0 ? (
        <p className="empty-state">{t('noProducts')}</p>
      ) : (
        <ul className="product-list">
          {products.map((product) => {
            const image = getProductCardImage(product);
            const imageAlt = getProductCardImageAlt({
              hasProductPhoto: Boolean(image),
              productTitle: formatProductTitle(product.title, locale),
              noPhotoAlt: tc('noProductPhotoAlt'),
            });
            const quantity = formatProductQuantityRange(
              product,
              product.unit ? tp(`units.${product.unit as 'kg'}`) : null,
            );
            const listedPrice = formatListedPrice(product);
            return (
              <li key={product.id} className="product-list__item product-list__item--with-media entity-card">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={imageAlt} className="product-list__media" />
                ) : (
                  <ProductPhotoPlaceholder
                    label={tc('noProductPhoto')}
                    alt={imageAlt}
                    className="product-list__media product-list__media--empty"
                  />
                )}
                <div>
                  <Link href={`/products/${product.id}`} className="product-list__title">
                    {product.display?.title?.trim() || formatProductTitle(product.title, locale)}
                  </Link>
                  <p className="product-list__meta">
                    {product.category
                      ? tc(`categories.${product.category as 'fruits'}`)
                      : tc('allCategories')}
                    {quantity ? ` · ${quantity}` : ''}
                  </p>
                  <p
                    className={`product-list__price${listedPrice ? '' : ' product-list__price--request'}`}
                  >
                    {listedPrice ?? tc('priceOnRequest')}
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
    </article>
  );
}
