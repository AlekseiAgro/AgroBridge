import type { PurchaseQuoteMineItem } from '@agrobridge/shared';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { OpenChatButton } from '@/components/OpenChatButton';
import { PurchaseRequestActionButton } from '@/components/PurchaseRequestActionButton';
import { Link } from '@/i18n/navigation';
import {
  formatQuotePrice,
  formatQuoteQuantity,
  quoteCardActions,
  quoteStatusBadgeClass,
} from '@/lib/quote-card-presentation';

type Props = {
  items: PurchaseQuoteMineItem[];
  emptyLabel?: string;
  empty?: ReactNode;
};

export async function PurchaseQuoteList({ items, emptyLabel, empty }: Props) {
  const t = await getTranslations('purchaseRequests');
  const tp = await getTranslations('product');
  const locale = await getLocale();

  if (items.length === 0) {
    return empty ?? <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="product-list quote-list">
      {items.map((item) => {
        const actions = quoteCardActions(item);
        const offeredQty = formatQuoteQuantity(
          item.quantity,
          item.unit ? tp(`units.${item.unit as 'kg'}`) : null,
        );
        const requestedQty = formatQuoteQuantity(
          item.request.quantity,
          item.request.unit ? tp(`units.${item.request.unit as 'kg'}`) : null,
        );
        const sentAt = new Date(item.createdAt).toLocaleString(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        const buyerName = item.request.buyer.displayName || t('anonymousBuyer');
        const title = item.request.title;

        return (
          <li
            key={item.id}
            className="product-list__item product-list__item--row quote-list__item"
            data-quote-status={item.status}
            data-quote-currency={item.currency}
          >
            <div className="product-list__item-body">
              <div className="quote-list__header">
                {item.canOpenRequest ? (
                  <Link href={`/requests/${item.request.id}`} className="product-list__title">
                    {title}
                  </Link>
                ) : (
                  <p className="product-list__title">{title}</p>
                )}
                <span
                  className={quoteStatusBadgeClass(item.status)}
                  title={t(`quoteStatusHints.${item.status}`)}
                >
                  {t(`quoteStatuses.${item.status}`)}
                </span>
              </div>
              <p className="product-list__meta quote-list__hint">
                {t(`quoteStatusHints.${item.status}`)}
              </p>
              <p className="product-list__price quote-list__price">
                <span className="quote-list__price-label">{t('price')}</span>
                {formatQuotePrice(item.priceAmount, item.currency)}
              </p>
              <p className="product-list__meta quote-list__facts">
                {offeredQty ? (
                  <span>
                    {t('quotedQuantity')}: {offeredQty}
                  </span>
                ) : null}
                {requestedQty ? (
                  <span>
                    {t('requestedQuantity')}: {requestedQty}
                  </span>
                ) : null}
              </p>
              <p className="product-list__meta">
                <Link href={`/users/${item.request.buyer.id}`} className="profile-link">
                  {buyerName}
                </Link>
                {' · '}
                {t('sentAt', { date: sentAt })}
                {' · '}
                {t(`statuses.${item.request.status}`)}
              </p>
              {item.canOpenRequest ? null : (
                <p className="product-list__meta">{t('requestUnavailable')}</p>
              )}
            </div>
            <div className="product-list__actions quote-list__actions">
              {actions.showMessageBuyer ? (
                <OpenChatButton
                  purchaseRequestId={item.request.id}
                  label={t('messageBuyer')}
                  variant="primary"
                />
              ) : null}
              {actions.showOpenRequest ? (
                <Link href={`/requests/${item.request.id}`} className="button button--ghost">
                  {t('openRequest')}
                </Link>
              ) : null}
              {actions.showWithdraw ? (
                <PurchaseRequestActionButton
                  requestId={item.request.id}
                  quoteId={item.id}
                  action="withdraw"
                  variant="danger-quiet"
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
