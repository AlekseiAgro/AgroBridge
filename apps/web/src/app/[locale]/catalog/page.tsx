import type { ProductSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CatalogFilters } from '@/components/CatalogFilters';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api';
import { getPrimaryProductImage } from '@/lib/product-image';
import { formatRegionLabel } from '@/lib/region';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; region?: string }>;
};

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('catalog');
  const tr = await getTranslations();
  const query = new URLSearchParams();
  if (filters.q) query.set('q', filters.q);
  if (filters.category) query.set('category', filters.category);
  if (filters.region) query.set('region', filters.region);

  let products: ProductSummary[] = [];
  let loadError: string | null = null;
  try {
    const path = query.toString() ? `/products?${query.toString()}` : '/products';
    products = await apiRequest<ProductSummary[]>(path);
  } catch {
    loadError = t('loadError');
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <h1>{t('title')}</h1>
        <p className="page__subtitle">{t('subtitle')}</p>
        <CatalogFilters
          initialQ={filters.q}
          initialCategory={filters.category}
          initialRegion={filters.region}
        />

        {loadError ? <p className="form-error">{loadError}</p> : null}

        {!loadError && products.length === 0 ? (
          <p className="empty-state">{t('empty')}</p>
        ) : (
          <ul className="product-list">
            {products.map((product) => {
              const image = getPrimaryProductImage(product.images);
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
                    {product.title}
                  </Link>
                  <p className="product-list__meta">
                    <Link href={`/farms/${product.farm.id}`}>{product.farm.name}</Link>
                    {product.farm.region
                      ? ` · ${formatRegionLabel(product.farm.region, tr) ?? product.farm.region}`
                      : ''}
                    {product.category ? ` · ${t(`categories.${product.category as 'fruits'}`)}` : ''}
                  </p>
                  {product.description ? (
                    <p className="product-list__desc">{product.description}</p>
                  ) : null}
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
