'use client';

import { PRODUCT_CATEGORIES } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  initialQ?: string;
  initialCategory?: string;
};

export function PurchaseRequestFilters({ initialQ = '', initialCategory = '' }: Props) {
  const t = useTranslations('purchaseRequests');
  const tc = useTranslations('catalog');
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const q = String(form.get('q') ?? '').trim();
    const category = String(form.get('category') ?? '');
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    const query = params.toString();
    router.push(query ? `/requests?${query}` : '/requests');
  }

  return (
    <form className="catalog-filters" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('search')}</span>
        <input name="q" defaultValue={initialQ} placeholder={t('searchPlaceholder')} />
      </label>
      <label className="field">
        <span>{t('category')}</span>
        <select name="category" defaultValue={initialCategory}>
          <option value="">{tc('allCategories')}</option>
          {PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {tc(`categories.${category}`)}
            </option>
          ))}
        </select>
      </label>
      <button className="button button--primary" type="submit">
        {t('applyFilters')}
      </button>
    </form>
  );
}
