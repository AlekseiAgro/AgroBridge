import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { OpenChatButton } from '@/components/OpenChatButton';
import { RfqActionButton } from '@/components/RfqActionButton';
import { RfqOfferForm } from '@/components/RfqOfferForm';
import { SiteHeader } from '@/components/SiteHeader';
import { Link, redirect } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function FarmerInboxDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (user!.role !== 'farmer' && user!.role !== 'admin') {
    redirect({ href: '/account', locale });
  }

  const t = await getTranslations('rfq');
  const tp = await getTranslations('product');

  let rfq: RfqSummary;
  try {
    rfq = await apiRequestAuthed<RfqSummary>(`/rfqs/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main narrow">
        <p className="eyebrow">
          <Link href="/dashboard/inbox">{t('inboxTitle')}</Link>
        </p>
        <h1>{rfq.product.title}</h1>
        <p className="page__subtitle">
          {t(`statuses.${rfq.status}`)} · {rfq.buyer.displayName || rfq.buyer.email}
        </p>

        <dl className="account-details">
          <div>
            <dt>{t('quantity')}</dt>
            <dd>
              {rfq.quantity}
              {rfq.unit ? ` ${tp(`units.${rfq.unit as 'kg'}`)}` : ''}
            </dd>
          </div>
          {rfq.message ? (
            <div>
              <dt>{t('buyerMessage')}</dt>
              <dd>{rfq.message}</dd>
            </div>
          ) : null}
          {rfq.offer ? (
            <div>
              <dt>{t('price')}</dt>
              <dd>
                {rfq.offer.priceAmount} {rfq.offer.currency}
              </dd>
            </div>
          ) : null}
        </dl>

        {rfq.status === 'pending' && !rfq.offer ? (
          <>
            <RfqOfferForm
              rfqId={rfq.id}
              defaultQuantity={rfq.quantity}
              defaultUnit={rfq.unit}
            />
            <div style={{ marginTop: '1rem' }}>
              <RfqActionButton rfqId={rfq.id} action="decline" />
            </div>
          </>
        ) : null}

        <div className="home__actions" style={{ marginTop: '1.25rem' }}>
          <OpenChatButton rfqId={rfq.id} />
        </div>
      </main>
    </div>
  );
}
