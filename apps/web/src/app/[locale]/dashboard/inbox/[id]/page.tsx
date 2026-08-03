import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { OpenChatButton } from '@/components/OpenChatButton';
import { RateDealForm } from '@/components/RateDealForm';
import { RatingStars } from '@/components/RatingStars';
import { RfqActionButton } from '@/components/RfqActionButton';
import { RfqOfferForm } from '@/components/RfqOfferForm';
import { Link, redirect } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { formatProductTitle } from '@/lib/product-title';
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
  const tr = await getTranslations('rating');
  const tProfile = await getTranslations('profile');

  let rfq: RfqSummary;
  try {
    rfq = await apiRequestAuthed<RfqSummary>(`/rfqs/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const buyerName = rfq.buyer.displayName || rfq.buyer.email;

  return (
    <main className="cabinet-page cabinet-page--narrow">
      <p className="eyebrow">
        <Link href="/dashboard/inbox">{t('inboxTitle')}</Link>
      </p>
      <h1>{formatProductTitle(rfq.product.title, locale)}</h1>
      <p className="page__subtitle">
        {t(`statuses.${rfq.status}`)} ·{' '}
        <Link href={`/users/${rfq.buyer.id}`} className="profile-link">
          {buyerName}
        </Link>
      </p>

      <dl className="account-details">
        <div>
          <dt>{tProfile('buyer')}</dt>
          <dd>
            <Link href={`/users/${rfq.buyer.id}`} className="profile-link">
              {buyerName}
            </Link>
          </dd>
        </div>
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
        {rfq.myRating ? (
          <div>
            <dt>{tr('yourRating')}</dt>
            <dd>
              <RatingStars value={rfq.myRating.score} showValue />
            </dd>
          </div>
        ) : null}
        {rfq.counterpartyRating ? (
          <div>
            <dt>{tr('theirRating')}</dt>
            <dd>
              <RatingStars value={rfq.counterpartyRating.score} showValue />
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
        {rfq.canComplete ? (
          <RfqActionButton rfqId={rfq.id} action="complete" variant="primary" />
        ) : null}
        <OpenChatButton rfqId={rfq.id} />
      </div>

      {rfq.canRate ? (
        <div style={{ marginTop: '1.75rem' }}>
          <RateDealForm rfqId={rfq.id} counterpartyName={buyerName} />
        </div>
      ) : null}
    </main>
  );
}
