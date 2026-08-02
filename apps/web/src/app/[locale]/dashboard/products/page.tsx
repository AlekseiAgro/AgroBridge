import type { ProductSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DeleteProductButton } from '@/components/DeleteProductButton';
import { SiteHeader } from '@/components/SiteHeader';
import { Link, redirect } from '@/i18n/navigation';
import { getPrimaryProductImage } from '@/lib/product-image';
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
  if (user!.role !== 'farmer' && user!.role !== 'admin') {
    redirect({ href: '/account', locale });
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
    <div className="page">
      <SiteHeader />
      <main className="page__main">
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
              const image = getPrimaryProductImage(product.images);
              return (
              <li key={product.id} className="product-list__item product-list__item--row">
                <div className="product-list__item-main">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.url} alt="" className="product-list__media product-list__media--sm" />
                  ) : (
                    <div
                      className="product-list__media product-list__media--sm product-list__media--empty"
                      aria-hidden
                    />
                  )}
                  <div>
                    <p className="product-list__title">{product.title}</p>
                    <p className="product-list__meta">
                      {t(`moderation.${product.moderationStatus}`)}
                      {product.category
                        ? ` · ${tc(`categories.${product.category as 'fruits'}`)}`
                        : ''}
                      {product.moderationNote ? ` · ${product.moderationNote}` : ''}
                    </p>
                  </div>
                </div>
                <div className="product-list__actions">
                  <Link className="button button--ghost" href={`/dashboard/products/${product.id}/edit`}>
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
    </div>
  );
}
