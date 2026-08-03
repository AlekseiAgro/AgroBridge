'use client';

import {
  GEORGIA_REGIONS,
  HARVEST_STATUSES,
  PRODUCT_CATEGORIES,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { FormEvent, useEffect, useState } from 'react';

type Props = {
  initialQ?: string;
  initialCategory?: string;
  initialRegion?: string;
  initialHarvestStatus?: string;
  initialPreorder?: boolean;
  initialInSeason?: boolean;
};

export function CatalogFilters({
  initialQ = '',
  initialCategory = '',
  initialRegion = '',
  initialHarvestStatus = '',
  initialPreorder = false,
  initialInSeason = false,
}: Props) {
  const t = useTranslations('catalog');
  const th = useTranslations('harvest');
  const tr = useTranslations();
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [category, setCategory] = useState(initialCategory);
  const [region, setRegion] = useState(initialRegion);
  const [harvestStatus, setHarvestStatus] = useState(initialHarvestStatus);
  const [preorder, setPreorder] = useState(initialPreorder);
  const [inSeason, setInSeason] = useState(initialInSeason);

  useEffect(() => {
    setQ(initialQ);
    setCategory(initialCategory);
    setRegion(initialRegion);
    setHarvestStatus(initialHarvestStatus);
    setPreorder(initialPreorder);
    setInSeason(initialInSeason);
  }, [
    initialQ,
    initialCategory,
    initialRegion,
    initialHarvestStatus,
    initialPreorder,
    initialInSeason,
  ]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    const search = q.trim();
    if (search) params.set('q', search);
    if (category.trim()) params.set('category', category.trim());
    if (region.trim()) params.set('region', region.trim());
    if (harvestStatus.trim()) params.set('harvestStatus', harvestStatus.trim());
    if (preorder) params.set('preorder', 'true');
    if (inSeason) params.set('inSeason', 'true');
    const query = params.toString();
    router.push(query ? `/catalog?${query}` : '/catalog');
  }

  return (
    <form className="catalog-filters" onSubmit={onSubmit}>
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
      <label className="field">
        <span>
          {th('statusLabel')} <span className="field__optional">{t('optional')}</span>
        </span>
        <select
          value={harvestStatus}
          onChange={(e) => setHarvestStatus(e.target.value)}
          name="harvestStatus"
        >
          <option value="">{th('allStatuses')}</option>
          {HARVEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {th(`status.${status}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={inSeason}
          onChange={(e) => setInSeason(e.target.checked)}
        />
        <span>{th('filterInSeason')}</span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={preorder}
          onChange={(e) => setPreorder(e.target.checked)}
        />
        <span>{th('filterPreorder')}</span>
      </label>
      <button className="button button--primary" type="submit">
        {t('applyFilters')}
      </button>
    </form>
  );
}
