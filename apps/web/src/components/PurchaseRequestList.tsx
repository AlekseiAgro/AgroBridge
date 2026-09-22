import type { PurchaseRequestSummary } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { requestStatusBadgeClass } from '@/lib/request-card-presentation';

type Props = {
  items: PurchaseRequestSummary[];
  emptyLabel?: string;
  empty?: ReactNode;
  detailBasePath?: string;
  variant?: 'board' | 'mine';
};

export async function PurchaseRequestList({
  items,
  emptyLabel,
  empty,
  detailBasePath = '/requests',
  variant = 'board',
}: Props) {
  const t = await getTranslations('purchaseRequests');
  const tc = await getTranslations('catalog');
  const tp = await getTranslations('product');

  if (items.length === 0) {
    return empty ?? <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="product-list">
      {items.map((item) => {
        const category = tc(`categories.${item.category as 'fruits'}`);
        const unit = item.unit ? ` ${tp(`units.${item.unit as 'kg'}`)}` : '';
        const quantity = `${item.quantity}${unit}`;
        const destination = item.destinationCountry;
        const ownerName = item.buyer.displayName || t('anonymousBuyer');

        if (variant === 'mine') {
          return (
            <li
              key={item.id}
              className="product-list__item product-list__item--row product-list__item--mine-requests"
              data-request-status={item.status}
            >
              <div className="product-list__item-main">
                <div className="product-list__item-body">
                  <div className="product-list__identity">
                    <Link href={`${detailBasePath}/${item.id}`} className="product-list__title">
                      {item.title}
                    </Link>
                    <span className={requestStatusBadgeClass(item.status)}>
                      {t(`statuses.${item.status}`)}
                    </span>
                  </div>
                  <p className="product-list__category">{category}</p>
                  <p className="product-list__qty">{quantity}</p>
                  {destination ? <p className="product-list__destination">{destination}</p> : null}
                  <p className="product-list__party">
                    <Link href={`/users/${item.buyer.id}`} className="profile-link">
                      {ownerName}
                    </Link>
                  </p>
                  {item.quoteCount > 0 ? (
                    <p className="product-list__context">{t('quoteCount', { count: item.quoteCount })}</p>
                  ) : null}
                </div>
              </div>
              <div className="product-list__actions">
                <Link
                  href={`${detailBasePath}/${item.id}`}
                  className="button button--ghost product-list__action--primary"
                >
                  {t('view')}
                </Link>
              </div>
            </li>
          );
        }

        return (
          <li key={item.id} className="product-list__item product-list__item--row">
            <div className="product-list__item-main">
              <Link href={`${detailBasePath}/${item.id}`} className="product-list__title">
                {item.title}
              </Link>
              <p className="product-list__meta">
                {category}
                {' · '}
                {quantity}
                {destination ? ` · ${destination}` : ''}
                {' · '}
                {t(`statuses.${item.status}`)}
              </p>
              <p className="product-list__meta">
                <Link href={`/users/${item.buyer.id}`} className="profile-link">
                  {ownerName}
                </Link>
                {item.quoteCount > 0 ? ` · ${t('quoteCount', { count: item.quoteCount })}` : ''}
              </p>
            </div>
            <Link href={`${detailBasePath}/${item.id}`} className="button button--ghost">
              {t('view')}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
