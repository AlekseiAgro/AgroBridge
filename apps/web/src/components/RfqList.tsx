import type { RfqSummary } from '@agrobridge/shared';
import { getLocale, getTranslations } from 'next-intl/server';
import { DeleteRfqButton } from '@/components/DeleteRfqButton';
import { Link } from '@/i18n/navigation';
import { formatProductTitle } from '@/lib/product-title';

type Props = {
  items: RfqSummary[];
  emptyLabel: string;
  detailBasePath: '/dashboard/rfqs' | '/dashboard/inbox';
  /** When true, cancelled rows get muted styling and a delete control. */
  allowDeleteCancelled?: boolean;
};

export async function RfqList({
  items,
  emptyLabel,
  detailBasePath,
  allowDeleteCancelled = false,
}: Props) {
  const t = await getTranslations('rfq');
  const locale = await getLocale();

  if (items.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  const isInbox = detailBasePath === '/dashboard/inbox';

  return (
    <ul className="product-list">
      {items.map((item) => {
        const cancelled = item.status === 'cancelled';
        const peer = isInbox
          ? item.buyer.displayName || item.buyer.email
          : item.farm?.name || item.seller.displayName || item.seller.email;
        const showDelete = allowDeleteCancelled && cancelled;

        return (
          <li
            key={item.id}
            className={[
              'product-list__item',
              'product-list__item--row',
              cancelled ? 'product-list__item--cancelled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="product-list__item-body">
              <Link href={`${detailBasePath}/${item.id}`} className="product-list__title">
                {formatProductTitle(item.product.title, locale)}
              </Link>
              <p className="product-list__meta">
                {t(`statuses.${item.status}`)}
                {' · '}
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ''}
                {' · '}
                {peer}
              </p>
              {item.offer ? (
                <p className="product-list__desc">
                  {t('offerSummary', {
                    amount: item.offer.priceAmount,
                    currency: item.offer.currency,
                  })}
                </p>
              ) : null}
            </div>
            {showDelete ? (
              <div className="product-list__actions">
                <DeleteRfqButton rfqId={item.id} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
