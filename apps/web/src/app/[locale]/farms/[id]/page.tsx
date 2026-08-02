import type { FarmDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function FarmDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('farm');
  const tc = await getTranslations('catalog');

  let farm: FarmDetail;
  try {
    farm = await apiRequest<FarmDetail>(`/farms/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <h1>{farm.name}</h1>
        <p className="page__subtitle">
          {farm.region || t('regionUnknown')}
          {farm.owner.displayName ? ` · ${farm.owner.displayName}` : ''}
        </p>
        {farm.description ? <p className="detail-text">{farm.description}</p> : null}

        <h2 className="section-title">{t('productsHeading')}</h2>
        {farm.products.length === 0 ? (
          <p className="empty-state">{t('noProducts')}</p>
        ) : (
          <ul className="product-list">
            {farm.products.map((product) => (
              <li key={product.id} className="product-list__item">
                <Link href={`/products/${product.id}`} className="product-list__title">
                  {product.title}
                </Link>
                <p className="product-list__meta">
                  {product.category
                    ? tc(`categories.${product.category as 'fruits'}`)
                    : tc('allCategories')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
