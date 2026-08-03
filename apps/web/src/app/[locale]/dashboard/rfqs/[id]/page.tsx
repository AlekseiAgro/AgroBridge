import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { OpenChatButton } from '@/components/OpenChatButton';
import { RateDealForm } from '@/components/RateDealForm';
import { RatingStars } from '@/components/RatingStars';
import { RfqActionButton } from '@/components/RfqActionButton';
import { Link, redirect } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { formatProductTitle } from '@/lib/product-title';
import { apiRequestAuthed } from '@/lib/server-api';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function BuyerRfqDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });

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

  const sellerName = rfq.seller.displayName || rfq.seller.email;

  return (
    <main className="cabinet-page cabinet-page--narrow">
      <p className="eyebrow">
        <Link href="/dashboard/rfqs">{t('mineTitle')}</Link>
      </p>
      <h1>{formatProductTitle(rfq.product.title, locale)}</h1>
      <p className="page__subtitle">
        {t(`statuses.${rfq.status}`)} ·{' '}
        <Link href={`/farms/${rfq.farm.id}`}>{rfq.farm.name}</Link>
        {' · '}
        <Link href={`/users/${rfq.seller.id}`} className="profile-link">
          {sellerName}
        </Link>
      </p>

      <dl className="account-details">
        <div>
          <dt>{tProfile('seller')}</dt>
          <dd>
            <Link href={`/users/${rfq.seller.id}`} className="profile-link">
              {sellerName}
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
            <dt>{t('message')}</dt>
            <dd>{rfq.message}</dd>
          </div>
        ) : null}
        {rfq.offer ? (
          <>
            <div>
              <dt>{t('price')}</dt>
              <dd>
                {rfq.offer.priceAmount} {rfq.offer.currency}
              </dd>
            </div>
            {rfq.offer.message ? (
              <div>
                <dt>{t('farmerMessage')}</dt>
                <dd>{rfq.offer.message}</dd>
              </div>
            ) : null}
          </>
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

      <div className="home__actions" style={{ marginTop: '1.25rem' }}>
        {rfq.status === 'pending' ? (
          <RfqActionButton rfqId={rfq.id} action="cancel" />
        ) : null}
        {rfq.status === 'offered' ? (
          <>
            <RfqActionButton rfqId={rfq.id} action="accept" variant="primary" />
            <RfqActionButton rfqId={rfq.id} action="decline" />
          </>
        ) : null}
        {rfq.canComplete ? (
          <RfqActionButton rfqId={rfq.id} action="complete" variant="primary" />
        ) : null}
        <OpenChatButton rfqId={rfq.id} />
      </div>

      {rfq.canRate ? (
        <div style={{ marginTop: '1.75rem' }}>
          <RateDealForm rfqId={rfq.id} counterpartyName={sellerName} />
        </div>
      ) : null}
    </main>
  );
}
