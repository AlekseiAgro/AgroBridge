import type { ProductPhoneCheckField, PurchaseRequestPhoneCheckField } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';

type Props = {
  fields: ReadonlyArray<ProductPhoneCheckField | PurchaseRequestPhoneCheckField>;
};

/** Moderator hint only. It never blocks, hides, or rejects the content. */
export function AdminPhoneFlag({ fields }: Props) {
  const t = useTranslations('admin.phoneFlag');
  if (fields.length === 0) return null;

  return (
    <p className="product-list__meta admin-phone-flag" data-phone-like-fields={fields.join(' ')}>
      <span className="harvest-badge harvest-badge--limited">{t('badge')}</span>{' '}
      {t('fields', { fields: fields.map((field) => t(`fieldNames.${field}`)).join(', ') })}
    </p>
  );
}
