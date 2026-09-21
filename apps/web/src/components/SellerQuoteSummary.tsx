import type { PurchaseQuoteView } from '@agrobridge/shared';
import { getLocale, getTranslations } from 'next-intl/server';
import { OpenChatButton } from '@/components/OpenChatButton';
import { PurchaseRequestActionButton } from '@/components/PurchaseRequestActionButton';
import {
  formatQuotePrice,
  formatQuoteQuantity,
  quoteStatusBadgeClass,
  sellerQuoteActions,
} from '@/lib/quote-card-presentation';

type Props = {
  requestId: string;
  quote: PurchaseQuoteView;
  canMessageBuyer: boolean;
};

export async function SellerQuoteSummary({ requestId, quote, canMessageBuyer }: Props) {
  const t = await getTranslations('purchaseRequests');
  const tp = await getTranslations('product');
  const locale = await getLocale();
  const actions = sellerQuoteActions({
    canMessageBuyer,
    canWithdraw: quote.canWithdraw,
  });
  const offeredQty = formatQuoteQuantity(
    quote.quantity,
    quote.unit ? tp(`units.${quote.unit as 'kg'}`) : null,
  );
  const sentAt = new Date(quote.createdAt).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <section className="seller-quote" aria-labelledby="your-quote-title">
      <h2 id="your-quote-title" className="section-title">
        {t('yourQuote')}
      </h2>
      <div
        className="product-list__item seller-quote__card"
        data-quote-status={quote.status}
        data-quote-currency={quote.currency}
      >
        <div className="seller-quote__top">
          <p className="product-list__price seller-quote__price">
            {formatQuotePrice(quote.priceAmount, quote.currency)}
          </p>
          <span
            className={quoteStatusBadgeClass(quote.status)}
            title={t(`quoteStatusHints.${quote.status}`)}
          >
            {t(`quoteStatuses.${quote.status}`)}
          </span>
        </div>
        <p className="product-list__meta seller-quote__hint">
          {t(`quoteStatusHints.${quote.status}`)}
        </p>
        <p className="product-list__meta seller-quote__facts">
          {offeredQty ? <span>{t('quotedQuantity')}: {offeredQty}</span> : null}
          <span>{t('sentAt', { date: sentAt })}</span>
        </p>
        {quote.message ? <p className="product-list__desc">{quote.message}</p> : null}
        {actions.showMessageBuyer || actions.showWithdraw ? (
          <div className="product-list__actions seller-quote__actions">
            {actions.showMessageBuyer ? (
              <OpenChatButton
                purchaseRequestId={requestId}
                label={t('messageBuyer')}
                variant="primary"
              />
            ) : null}
            {actions.showWithdraw ? (
              <PurchaseRequestActionButton
                requestId={requestId}
                quoteId={quote.id}
                action="withdraw"
                variant="danger-quiet"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
