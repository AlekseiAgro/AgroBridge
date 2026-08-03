import type { ProductDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function NewProductPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale });
  }

  const t = await getTranslations('product');

  // Create a draft first so photo/video uploads are available before Basics.
  const product = await apiRequestAuthed<ProductDetail>('/products', {
    method: 'POST',
    body: {
      title: t('draftTitle'),
      isPublished: false,
    },
  });

  redirect({ href: `/dashboard/products/${product.id}/edit`, locale });
}
