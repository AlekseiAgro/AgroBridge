import type { ProductDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ModerationActions } from '@/components/ModerationActions';
import { ProductModerationPreview } from '@/components/ProductModerationPreview';
import { Link, redirect } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

function previewStatusKey(
  status: ProductDetail['moderationStatus'],
): 'previewPending' | 'previewRejected' | 'previewApproved' | 'previewDraft' {
  if (status === 'pending') return 'previewPending';
  if (status === 'rejected') return 'previewRejected';
  if (status === 'approved') return 'previewApproved';
  return 'previewDraft';
}

export default async function AdminProductModerationPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'admin') redirect({ href: '/account', locale });

  const t = await getTranslations('admin');

  let product: ProductDetail;
  try {
    product = await apiRequestAuthed<ProductDetail>(`/admin/products/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const queueHref = `/dashboard/admin?section=products&status=${product.moderationStatus}`;
  const bannerClass =
    product.moderationStatus === 'approved' ? 'page__subtitle' : 'form-error';

  return (
    <main className="cabinet-page">
      <p className="eyebrow">
        <Link href={queueHref}>{t('backToQueue')}</Link>
      </p>
      <h1>{t('previewTitle')}</h1>
      <p className="page__subtitle">{t('previewLead')}</p>
      <p className={bannerClass} role="status">
        {t(previewStatusKey(product.moderationStatus))}
      </p>
      {product.moderationNote ? (
        <p className="form-error">
          {t('note')}: {product.moderationNote}
        </p>
      ) : null}

      <ProductModerationPreview product={product} locale={locale} />

      <div style={{ marginTop: '1.5rem' }}>
        <ModerationActions productId={product.id} returnHref={queueHref} />
      </div>
    </main>
  );
}
