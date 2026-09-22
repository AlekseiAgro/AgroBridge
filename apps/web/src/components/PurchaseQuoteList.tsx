import type { PurchaseQuoteMineItem } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import {
  formatQuotePrice,
  formatQuoteQuantity,
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

  if (items.length === 0) {
    return empty ?? <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="product-list">
      {items.map((item) => {
        const quantity = formatQuoteQuantity(
          item.request.quantity,
          item.request.unit ? tp(`units.${item.request.unit as 'kg'}`) : null,
        );
        return (
          <li
            key={item.id}
            className="product-list__item product-list__item--row product-list__item--quotes"
            data-quote-status={item.status}
          >
            <div className="product-list__item-main">
              <div className="product-list__item-body">
                <div className="product-list__identity">
                  {item.canOpenRequest ? (
                    <Link href={`/requests/${item.request.id}`} className="product-list__title">
                      {item.request.title}
                    </Link>
                  ) : (
                    <p className="product-list__title">{item.request.title}</p>
                  )}
                  <span className={quoteStatusBadgeClass(item.status)}>
                    {t(`quoteStatuses.${item.status}`)}
                  </span>
                </div>
                <p className="product-list__price">
                  {formatQuotePrice(item.priceAmount, item.currency)}
                </p>
                {quantity ? <p className="product-list__qty">{quantity}</p> : null}
                <p className="product-list__party">
                  <Link href={`/users/${item.request.buyer.id}`} className="profile-link">
                    {item.request.buyer.displayName || t('anonymousBuyer')}
                  </Link>
                </p>
                <p className="product-list__context">
                  {t(`statuses.${item.request.status}`)}
                </p>
                {item.canOpenRequest ? null : (
                  <p className="product-list__meta">{t('requestUnavailable')}</p>
                )}
              </div>
            </div>
            <div className="product-list__actions">
              {item.canOpenRequest ? (
                <Link
                  href={`/requests/${item.request.id}`}
                  className="button button--ghost product-list__action--primary"
                >
                  {t('openRequest')}
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
