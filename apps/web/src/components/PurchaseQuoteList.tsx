import type { PurchaseQuoteMineItem } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Props = {
  items: PurchaseQuoteMineItem[];
  emptyLabel: string;
};

export async function PurchaseQuoteList({ items, emptyLabel }: Props) {
  const t = await getTranslations('purchaseRequests');
  const tp = await getTranslations('product');

  if (items.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="product-list">
      {items.map((item) => (
        <li key={item.id} className="product-list__item product-list__item--row">
          <div className="product-list__item-main">
            {item.canOpenRequest ? (
              <Link href={`/requests/${item.request.id}`} className="product-list__title">
                {item.request.title}
              </Link>
            ) : (
              <p className="product-list__title">{item.request.title}</p>
            )}
            <p className="product-list__meta">
              {item.priceAmount} {item.currency}
              {' · '}
              {t(`quoteStatuses.${item.status}`)}
              {' · '}
              {t(`statuses.${item.request.status}`)}
            </p>
            <p className="product-list__meta">
              {item.request.quantity}
              {item.request.unit ? ` ${tp(`units.${item.request.unit as 'kg'}`)}` : ''}
              {' · '}
              <Link href={`/users/${item.request.buyer.id}`} className="profile-link">
                {item.request.buyer.displayName || t('anonymousBuyer')}
              </Link>
            </p>
            {item.canOpenRequest ? null : (
              <p className="product-list__meta">{t('requestUnavailable')}</p>
            )}
          </div>
          {item.canOpenRequest ? (
            <Link href={`/requests/${item.request.id}`} className="button button--ghost">
              {t('openRequest')}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
