import type { ProductDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ProductDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('product');
  const tc = await getTranslations('catalog');
  const token = await getAuthToken();

  let product: ProductDetail;
  try {
    product = await apiRequest<ProductDetail>(`/products/${id}`, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/catalog">{tc('title')}</Link>
        </p>
        <h1>{product.title}</h1>
        <p className="page__subtitle">
          <Link href={`/farms/${product.farm.id}`}>{product.farm.name}</Link>
          {product.farm.region ? ` · ${product.farm.region}` : ''}
        </p>

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
        </dl>

        {product.description ? <p className="detail-text">{product.description}</p> : null}
      </main>
    </div>
  );
}
