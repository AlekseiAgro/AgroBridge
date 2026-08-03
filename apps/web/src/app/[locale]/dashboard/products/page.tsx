import type { ProductSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CertificateBadges } from '@/components/CertificateBadges';
import { DeleteProductButton } from '@/components/DeleteProductButton';
import { QualityScoreChip } from '@/components/QualityScoreChip';
import { Link, redirect } from '@/i18n/navigation';
import { getProductCardImage } from '@/lib/product-image';
import { formatProductQuantityRange } from '@/lib/product-quantity';
import { formatProductTitle } from '@/lib/product-title';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardProductsPage({ params }: Props) {
  const { locale } = await params;
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
    error = t('needFarmFirst');
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

      {error ? (
        <p className="form-error">
          {error} <Link href="/dashboard/farm">{t('goCreateFarm')}</Link>
        </p>
      ) : null}

      {!error && products.length === 0 ? (
        <p className="empty-state">{t('emptyMine')}</p>
      ) : (
        <ul className="product-list">
          {products.map((product) => {
            const image = getProductCardImage(product);
            const quantity = formatProductQuantityRange(
              product,
              product.unit ? t(`units.${product.unit as 'kg'}`) : null,
            );
            return (
              <li key={product.id} className="product-list__item product-list__item--row">
                <div className="product-list__item-main">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt=""
                      className="product-list__media product-list__media--sm"
                    />
                  ) : (
                    <div
                      className="product-list__media product-list__media--sm product-list__media--empty"
                      aria-hidden
                    />
                  )}
                  <div>
                    <p className="product-list__title">
                      {formatProductTitle(product.title, locale)}
                    </p>
                    <p className="product-list__meta">
                      {t(`moderation.${product.moderationStatus}`)}
                      {product.category
                        ? ` · ${tc(`categories.${product.category as 'fruits'}`)}`
                        : ''}
                      {quantity ? ` · ${quantity}` : ''}
                      {product.moderationNote ? ` · ${product.moderationNote}` : ''}
                    </p>
                    <div className="product-quality-summary">
                      <QualityScoreChip score={product.qualityScore} />
                      <CertificateBadges badges={product.certificateBadges} />
                    </div>
                  </div>
                </div>
                <div className="product-list__actions">
                  <Link
                    className="button button--ghost"
                    href={`/dashboard/products/${product.id}/edit`}
                  >
                    {t('edit')}
                  </Link>
                  <DeleteProductButton productId={product.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
