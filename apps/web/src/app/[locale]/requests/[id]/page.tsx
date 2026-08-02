import type { PurchaseRequestDetail } from '@agrobridge/shared';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { OpenChatButton } from '@/components/OpenChatButton';
import { PurchaseQuoteForm } from '@/components/PurchaseQuoteForm';
import { PurchaseRequestActionButton } from '@/components/PurchaseRequestActionButton';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Link } from '@/i18n/navigation';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';
import { formatRegionLabel } from '@/lib/region';
import { getCurrentUser } from '@/lib/session';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function PurchaseRequestDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('purchaseRequests');
  const tc = await getTranslations('catalog');
  const tp = await getTranslations('product');
  const tr = await getTranslations();
  const user = await getCurrentUser();
  const token = await getAuthToken();

  let request: PurchaseRequestDetail;
  try {
    request = await apiRequest<PurchaseRequestDetail>(`/purchase-requests/${id}`, { token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const isBuyer = user?.role === 'buyer' || user?.role === 'admin';
  const isFarmer = user?.role === 'farmer' || user?.role === 'admin';
  const buyerName = request.buyer.displayName || t('anonymousBuyer');

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <p className="eyebrow">
          <Link href="/requests">{t('boardTitle')}</Link>
        </p>
        <div className="page__heading-row">
          <div>
            <h1>{request.title}</h1>
            <p className="page__subtitle">
              {t(`statuses.${request.status}`)} · {buyerName}
            </p>
          </div>
          {isBuyer && user?.id === request.buyer.id ? (
            <Link href="/dashboard/purchase-requests" className="button button--ghost">
              {t('mineTitle')}
            </Link>
          ) : null}
        </div>

        <dl className="account-details">
          <div>
            <dt>{t('category')}</dt>
            <dd>{tc(`categories.${request.category as 'fruits'}`)}</dd>
          </div>
          <div>
            <dt>{t('quantity')}</dt>
            <dd>
              {request.quantity}
              {request.unit ? ` ${tp(`units.${request.unit as 'kg'}`)}` : ''}
            </dd>
          </div>
          {request.variety ? (
            <div>
              <dt>{t('variety')}</dt>
              <dd>{request.variety}</dd>
            </div>
          ) : null}
          {request.packaging ? (
            <div>
              <dt>{t('packaging')}</dt>
              <dd>{request.packaging}</dd>
            </div>
          ) : null}
          {request.destinationCountry ? (
            <div>
              <dt>{t('destinationCountry')}</dt>
              <dd>{request.destinationCountry}</dd>
            </div>
          ) : null}
          {request.message ? (
            <div>
              <dt>{t('message')}</dt>
              <dd>{request.message}</dd>
            </div>
          ) : null}
        </dl>

        <div className="home__actions" style={{ marginTop: '1.25rem' }}>
          {request.canCancel ? (
            <PurchaseRequestActionButton requestId={request.id} action="cancel" />
          ) : null}
          {request.canClose ? (
            <PurchaseRequestActionButton requestId={request.id} action="close" />
          ) : null}
          {request.canMessageBuyer ? (
            <OpenChatButton purchaseRequestId={request.id} label={t('messageBuyer')} />
          ) : null}
          {!user ? (
            <Link href="/login" className="button button--primary">
              {t('loginToRespond')}
            </Link>
          ) : null}
        </div>

        {request.canQuote ? (
          <div style={{ marginTop: '2rem' }}>
            <PurchaseQuoteForm
              requestId={request.id}
              defaultQuantity={request.quantity}
              defaultUnit={request.unit}
            />
          </div>
        ) : null}

        {request.myQuote && isFarmer ? (
          <section style={{ marginTop: '2rem' }}>
            <h2 className="section-title">{t('yourQuote')}</h2>
            <dl className="account-details">
              <div>
                <dt>{t('price')}</dt>
                <dd>
                  {request.myQuote.priceAmount} {request.myQuote.currency}
                </dd>
              </div>
              <div>
                <dt>{t('quoteStatus')}</dt>
                <dd>{t(`quoteStatuses.${request.myQuote.status}`)}</dd>
              </div>
              {request.myQuote.message ? (
                <div>
                  <dt>{t('message')}</dt>
                  <dd>{request.myQuote.message}</dd>
                </div>
              ) : null}
            </dl>
            {request.myQuote.canWithdraw ? (
              <div style={{ marginTop: '1rem' }}>
                <PurchaseRequestActionButton
                  requestId={request.id}
                  quoteId={request.myQuote.id}
                  action="withdraw"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {request.quotes.length > 0 && (user?.id === request.buyer.id || user?.role === 'admin') ? (
          <section style={{ marginTop: '2rem' }}>
            <h2 className="section-title">{t('quotesTitle')}</h2>
            <ul className="product-list">
              {request.quotes.map((quote) => (
                <li key={quote.id} className="product-list__item">
                  <p className="product-list__title">{quote.farm.name}</p>
                  <p className="product-list__meta">
                    {quote.priceAmount} {quote.currency}
                    {quote.quantity
                      ? ` · ${quote.quantity}${quote.unit ? ` ${tp(`units.${quote.unit as 'kg'}`)}` : ''}`
                      : ''}
                    {quote.farm.region
                      ? ` · ${formatRegionLabel(quote.farm.region, tr) ?? quote.farm.region}`
                      : ''}
                    {' · '}
                    {t(`quoteStatuses.${quote.status}`)}
                  </p>
                  {quote.message ? <p className="product-list__desc">{quote.message}</p> : null}
                  <div className="home__actions" style={{ marginTop: '0.85rem' }}>
                    {quote.canAccept ? (
                      <PurchaseRequestActionButton
                        requestId={request.id}
                        quoteId={quote.id}
                        action="accept"
                        variant="primary"
                      />
                    ) : null}
                    {quote.canDecline ? (
                      <PurchaseRequestActionButton
                        requestId={request.id}
                        quoteId={quote.id}
                        action="decline"
                      />
                    ) : null}
                    <OpenChatButton
                      purchaseRequestId={request.id}
                      farmerId={quote.farm.ownerId}
                      label={t('messageFarmer')}
                      variant="ghost"
                    />
                    <Link href={`/farms/${quote.farm.id}`} className="button button--ghost">
                      {t('viewFarm')}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {request.quoteCount === 0 && user?.id === request.buyer.id ? (
          <p className="empty-state" style={{ marginTop: '2rem' }}>
            {t('noQuotesYet')}
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
