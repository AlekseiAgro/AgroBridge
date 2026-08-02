import type { ProductDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RatingStars } from '@/components/RatingStars';
import { RfqRequestForm } from '@/components/RfqRequestForm';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';
import { getProductCardImage, toPublicMediaUrl } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
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

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/catalog">{tc('title')}</Link>
        </p>
        <h1>{product.title}</h1>
        <div className="product-list__seller product-list__seller--detail">
          <div className="product-list__seller-main">
            <span className="product-list__seller-label">{tc('seller')}</span>
            <Link href={`/farms/${product.farm.id}`} className="product-list__seller-name">
              {product.farm.name}
            </Link>
            {product.farm.owner?.displayName ? (
              <Link
                href={`/users/${product.farm.owner.id}`}
                className="product-list__seller-person"
              >
                {product.farm.owner.displayName}
              </Link>
            ) : null}
          </div>
          <div className="product-list__seller-rating">
            <RatingStars
              value={product.farm.sellerRating?.average ?? null}
              count={product.farm.sellerRating?.count ?? 0}
              size="sm"
            />
          </div>
        </div>
        {product.farm.region ? (
          <p className="page__subtitle">
            {formatRegionLabel(product.farm.region, tRoot) ?? product.farm.region}
          </p>
        ) : null}

        {product.images.length > 0 ? (
          <div className="product-gallery">
            {product.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={toPublicMediaUrl(image.url)}
                alt={product.title}
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
              alt={product.title}
              className="product-gallery__image product-gallery__image--primary"
            />
          </div>
        ) : null}

        <dl className="account-details">
          {product.category ? (
            <div>
              <dt>{t('category')}</dt>
              <dd>{tc(`categories.${product.category as 'fruits'}`)}</dd>
            </div>
          ) : null}
          {product.unit ? (
            <div>
              <dt>{t('unit')}</dt>
              <dd>{t(`units.${product.unit as 'kg'}`)}</dd>
            </div>
          ) : null}
          {quantityLabel ? (
            <div>
              <dt>{t('availableQuantity')}</dt>
              <dd>{quantityLabel}</dd>
            </div>
          ) : null}
        </dl>

        {product.description ? <p className="detail-text">{product.description}</p> : null}

        {user?.role === 'buyer' || user?.role === 'admin' ? (
          <div style={{ marginTop: '1.75rem' }}>
            <RfqRequestForm productId={product.id} defaultUnit={product.unit} />
          </div>
        ) : !user ? (
          <p className="auth-card__footer" style={{ marginTop: '1.5rem' }}>
            <Link href="/login">{tr('loginToRequest')}</Link>
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
