import { formatListedPrice, type ProductSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CertificateBadges } from '@/components/CertificateBadges';
import { HarvestStatusBadge } from '@/components/HarvestStatusBadge';
import { MyProductCardActions } from '@/components/MyProductCardActions';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { Link, redirect } from '@/i18n/navigation';
import { EmptyState } from '@/components/EmptyState';
import { ProductPhotoPlaceholder } from '@/components/ProductPhotoPlaceholder';
import { getProductCardImage, getProductCardImageAlt } from '@/lib/product-image';
import { formatCurrentStock, formatProductQuantityRange } from '@/lib/product-quantity';
import { formatProductTitle } from '@/lib/product-title';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function DashboardProductsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { filter } = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
  }

  const t = await getTranslations('product');
  const tc = await getTranslations('catalog');

  let products: ProductSummary[] = [];
  let error: string | null = null;
  try {
    products = await apiRequestAuthed<ProductSummary[]>('/products/mine');
  } catch {
    error = t('loadError');
  }

  if (filter === 'published') {
    products = products.filter(
      (product) => product.isPublished && product.moderationStatus === 'approved',
    );
  } else if (filter === 'pending') {
    products = products.filter((product) => product.moderationStatus === 'pending');
  }

  return (
    <main className="cabinet-page">
      <div className="page__heading-row">
        <div>
          <h1>{t('dashboardTitle')}</h1>
          <p className="page__subtitle">{t('dashboardSubtitle')}</p>
        </div>
        <Link className="button button--primary" href="/dashboard/products/new">
          {t('addProduct')}
        </Link>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {!error && products.length === 0 ? (
        <EmptyState
          title={
            filter === 'published'
              ? t('emptyPublishedTitle')
              : filter === 'pending'
                ? t('emptyPendingTitle')
                : t('emptyMineTitle')
          }
          body={
            filter === 'published'
              ? t('emptyPublished')
              : filter === 'pending'
                ? t('emptyPending')
                : t('emptyMine')
          }
          actions={
            <>
              {filter ? (
                <Link href="/dashboard/products" className="button button--ghost">
                  {t('emptyShowAll')}
                </Link>
              ) : null}
              <Link className="button button--primary" href="/dashboard/products/new">
                {t('addProduct')}
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
              noPhotoAlt: tc('noProductPhotoAlt'),
            });
            const quantity = formatProductQuantityRange(
              product,
              product.unit ? t(`units.${product.unit as 'kg'}`) : null,
            );
            const stock = formatCurrentStock(product);
            const listedPrice = formatListedPrice(product);
            const previewHref = `/products/${product.id}`;
            const hasAvailability =
              Boolean(product.harvestStatus) ||
              product.preorderEnabled ||
              Boolean(stock) ||
              Boolean(listedPrice);
            const meta = [
              product.category ? tc(`categories.${product.category as 'fruits'}`) : null,
              quantity,
              product.moderationNote,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <li
                key={product.id}
                className="product-list__item product-list__item--row product-list__item--mine"
              >
                <div className="product-list__item-main">
                  <Link
                    href={previewHref}
                    className="product-list__media-link"
                    aria-label={t('preview')}
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image.url}
                        alt={imageAlt}
                        className="product-list__media product-list__media--sm"
                      />
                    ) : (
                      <ProductPhotoPlaceholder
                        label={tc('noProductPhoto')}
                        alt={imageAlt}
                        className="product-list__media product-list__media--sm"
                      />
                    )}
                  </Link>
                  <div className="product-list__item-body">
                    <div className="product-list__identity">
                      <Link href={previewHref} className="product-list__title">
                        {formatProductTitle(product.title, locale)}
                      </Link>
                      {hasAvailability ? (
                        <div className="product-list__availability">
                          <HarvestStatusBadge
                            status={product.harvestStatus}
                            preorderEnabled={product.preorderEnabled}
                          />
                          {stock ? <p className="product-list__stock">{stock}</p> : null}
                          {listedPrice ? (
                            <p className="product-list__price">{listedPrice}</p>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="product-list__status">
                        {t(`moderation.${product.moderationStatus}`)}
                      </p>
                      <p className="product-list__metrics" aria-label={t('cardMetricsLabel')}>
                        <span>
                          <span className="product-list__metric-icon" aria-hidden="true">
                            👁
                          </span>{' '}
                          {t('viewCount', { count: product.viewCount ?? 0 })}
                        </span>
                        <span>
                          <span className="product-list__metric-icon" aria-hidden="true">
                            🔔
                          </span>{' '}
                          {t('subscriberCount', { count: product.watchCount ?? 0 })}
                        </span>
                      </p>
                    </div>
                    <div className="product-quality-summary">
                      <QualityScoreChip score={product.qualityScore} />
                      <CertificateBadges badges={product.certificateBadges} />
                    </div>
                    {meta ? <p className="product-list__meta">{meta}</p> : null}
                  </div>
                </div>
                <MyProductCardActions
                  productId={product.id}
                  harvestStatus={product.harvestStatus}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
