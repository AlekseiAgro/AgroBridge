import type { RfqSummary } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Props = {
  items: RfqSummary[];
  emptyLabel: string;
  detailBasePath: '/dashboard/rfqs' | '/dashboard/inbox';
};

export async function RfqList({ items, emptyLabel, detailBasePath }: Props) {
  const t = await getTranslations('rfq');

  if (items.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="product-list">
      {items.map((item) => (
        <li key={item.id} className="product-list__item">
          <Link href={`${detailBasePath}/${item.id}`} className="product-list__title">
            {item.product.title}
          </Link>
          <p className="product-list__meta">
            {t(`statuses.${item.status}`)}
            {' · '}
            {item.quantity}
            {item.unit ? ` ${item.unit}` : ''}
            {' · '}
            {item.farm.name}
          </p>
          {item.offer ? (
            <p className="product-list__desc">
              {t('offerSummary', {
                amount: item.offer.priceAmount,
                currency: item.offer.currency,
              })}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
