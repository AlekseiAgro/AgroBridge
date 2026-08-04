import type { AlertSubscription } from '@agrobridge/shared';
import { getTranslations } from 'next-intl/server';

type Props = {
  subscription: AlertSubscription;
};

export async function ActiveAlertSubscriptions({ subscription }: Props) {
  const t = await getTranslations('subscriptions');
  const tc = await getTranslations('catalog');
  const tr = await getTranslations();

  const categoryLabel = subscription.allCategories
    ? t('allCategories')
    : subscription.categories.map((category) => tc(`categories.${category}`)).join(', ');
  const regionLabel = subscription.allRegions
    ? t('allRegions')
    : subscription.regions.map((region) => tr(`regions.${region}`)).join(', ');

  const items: { key: string; title: string; meta: string }[] = [];
  if (subscription.notifyProducts) {
    items.push({
      key: 'products',
      title: t('notifyProducts'),
      meta: `${categoryLabel} · ${regionLabel}`,
    });
  }
  if (subscription.notifyPurchaseRequests) {
    items.push({
      key: 'purchase-requests',
      title: t('notifyPurchaseRequests'),
      meta: categoryLabel,
    });
  }

  if (items.length === 0) {
    return <p className="empty-state">{t('activeAlertsEmpty')}</p>;
  }

  return (
    <ul className="active-subscriptions">
      {items.map((item) => (
        <li key={item.key} className="active-subscriptions__item">
          <p className="active-subscriptions__title">{item.title}</p>
          <p className="product-list__meta">{item.meta}</p>
        </li>
      ))}
    </ul>
  );
}
