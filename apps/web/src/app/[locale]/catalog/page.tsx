import type { ProductSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CatalogFilters } from '@/components/CatalogFilters';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; region?: string }>;
};

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('catalog');
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
            {products.map((product) => (
              <li key={product.id} className="product-list__item">
                <div>
                  <Link href={`/products/${product.id}`} className="product-list__title">
                    {product.title}
                  </Link>
                  <p className="product-list__meta">
                    <Link href={`/farms/${product.farm.id}`}>{product.farm.name}</Link>
                    {product.farm.region ? ` · ${product.farm.region}` : ''}
                    {product.category ? ` · ${t(`categories.${product.category as 'fruits'}`)}` : ''}
                  </p>
                  {product.description ? (
                    <p className="product-list__desc">{product.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
