import type { PurchaseRequestSummary } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Props = {
  items: PurchaseRequestSummary[];
  emptyLabel: string;
  detailBasePath?: string;
};

export async function PurchaseRequestList({
  items,
  emptyLabel,
  detailBasePath = '/requests',
}: Props) {
  const t = await getTranslations('purchaseRequests');
  const tc = await getTranslations('catalog');
  const tp = await getTranslations('product');

  if (items.length === 0) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="product-list">
      {items.map((item) => (
        <li key={item.id} className="product-list__item product-list__item--row">
          <div className="product-list__item-main">
            <Link href={`${detailBasePath}/${item.id}`} className="product-list__title">
              {item.title}
            </Link>
            <p className="product-list__meta">
              {tc(`categories.${item.category as 'fruits'}`)}
              {' · '}
              {item.quantity}
              {item.unit ? ` ${tp(`units.${item.unit as 'kg'}`)}` : ''}
              {item.destinationCountry ? ` · ${item.destinationCountry}` : ''}
              {' · '}
              {t(`statuses.${item.status}`)}
            </p>
            <p className="product-list__meta">
              {item.buyer.displayName || t('anonymousBuyer')}
              {item.quoteCount > 0 ? ` · ${t('quoteCount', { count: item.quoteCount })}` : ''}
            </p>
          </div>
          <Link href={`${detailBasePath}/${item.id}`} className="button button--ghost">
            {t('view')}
          </Link>
        </li>
      ))}
    </ul>
  );
}
