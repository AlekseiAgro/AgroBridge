import type { ProductDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ProductForm } from '@/components/ProductForm';
import { ProductCertificatesManager } from '@/components/ProductCertificatesManager';
import { ProductImagesManager } from '@/components/ProductImagesManager';
import { ProductVideosManager } from '@/components/ProductVideosManager';
import { redirect } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EditProductPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
  }

  const t = await getTranslations('product');

  let product: ProductDetail;
  try {
    product = await apiRequestAuthed<ProductDetail>(`/products/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="cabinet-page cabinet-page--narrow">
      <h1>{t('editTitle')}</h1>
      <p className="page__subtitle">{t('editSubtitle')}</p>
      <ProductImagesManager productId={product.id} initialImages={product.images} />
      <ProductVideosManager productId={product.id} initialVideos={product.videos} />
      <ProductForm mode="edit" initial={product} />
      <ProductCertificatesManager
        productId={product.id}
        initialCertificates={product.certificates}
      />
    </main>
  );
}
