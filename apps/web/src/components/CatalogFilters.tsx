'use client';

import { PRODUCT_CATEGORIES } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { FormEvent, useState } from 'react';

type Props = {
  initialQ?: string;
  initialCategory?: string;
  initialRegion?: string;
};

export function CatalogFilters({ initialQ = '', initialCategory = '', initialRegion = '' }: Props) {
  const t = useTranslations('catalog');
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [region, setRegion] = useState(initialRegion);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    if (region.trim()) params.set('region', region.trim());
    const query = params.toString();
    router.push(query ? `/catalog?${query}` : '/catalog');
  }

  return (
    <form className="catalog-filters" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('search')}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} name="q" />
      </label>
      <label className="field">
        <span>{t('category')}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} name="category">
          <option value="">{t('allCategories')}</option>
          {PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`categories.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('region')}</span>
        <input value={region} onChange={(e) => setRegion(e.target.value)} name="region" />
      </label>
      <button className="button button--primary" type="submit">
        {t('applyFilters')}
      </button>
    </form>
  );
}
