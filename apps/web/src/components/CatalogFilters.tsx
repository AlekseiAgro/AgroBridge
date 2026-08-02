'use client';

import { GEORGIA_REGIONS, PRODUCT_CATEGORIES } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { FormEvent, useEffect, useState } from 'react';

type Props = {
  initialQ?: string;
  initialCategory?: string;
  initialRegion?: string;
};

export function CatalogFilters({
  initialQ = '',
  initialCategory = '',
  initialRegion = '',
}: Props) {
  const t = useTranslations('catalog');
  const tr = useTranslations();
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [region, setRegion] = useState(initialRegion);

  useEffect(() => {
    setQ(initialQ);
    setCategory(initialCategory);
    setRegion(initialRegion);
  }, [initialQ, initialCategory, initialRegion]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    const search = q.trim();
    // Category and region are optional: only send them when explicitly chosen.
    if (search) params.set('q', search);
    if (category.trim()) params.set('category', category.trim());
    if (region.trim()) params.set('region', region.trim());
    const query = params.toString();
    router.push(query ? `/catalog?${query}` : '/catalog');
  }

  return (
    <form className="catalog-filters" onSubmit={onSubmit}>
      <p className="catalog-filters__hint">{t('filtersHint')}</p>
      <label className="field">
        <span>{t('search')}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          name="q"
          type="search"
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>
          {t('category')} <span className="field__optional">{t('optional')}</span>
        </span>
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
        <span>
          {t('region')} <span className="field__optional">{t('optional')}</span>
        </span>
        <select value={region} onChange={(e) => setRegion(e.target.value)} name="region">
          <option value="">{t('allRegions')}</option>
          {GEORGIA_REGIONS.map((value) => (
            <option key={value} value={value}>
              {tr(`regions.${value}`)}
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
