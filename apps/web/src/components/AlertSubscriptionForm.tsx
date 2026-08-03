'use client';

import type { AlertSubscription } from '@agrobridge/shared';
import { GEORGIA_REGIONS, PRODUCT_CATEGORIES } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  initial: AlertSubscription;
};

export function AlertSubscriptionForm({ initial }: Props) {
  const t = useTranslations('subscriptions');
  const tc = useTranslations('catalog');
  const tr = useTranslations();
  const router = useRouter();

  const [notifyProducts, setNotifyProducts] = useState(initial.notifyProducts);
  const [notifyPurchaseRequests, setNotifyPurchaseRequests] = useState(
    initial.notifyPurchaseRequests,
  );
  const [allCategories, setAllCategories] = useState(initial.allCategories);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [allRegions, setAllRegions] = useState(initial.allRegions);
  const [regions, setRegions] = useState<string[]>(initial.regions);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleValue(
    list: string[],
    value: string,
    setter: (next: string[]) => void,
  ) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/subscriptions/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyProducts,
          notifyPurchaseRequests,
          allCategories,
          categories: allCategories ? [] : categories,
          allRegions,
          regions: allRegions ? [] : regions,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <fieldset className="field-group">
        <legend className="section-title">{t('channelsTitle')}</legend>
        <p className="page__subtitle">{t('channelsHint')}</p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={notifyProducts}
            onChange={(event) => setNotifyProducts(event.target.checked)}
          />
          <span>{t('notifyProducts')}</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={notifyPurchaseRequests}
            onChange={(event) => setNotifyPurchaseRequests(event.target.checked)}
          />
          <span>{t('notifyPurchaseRequests')}</span>
        </label>
      </fieldset>

      <fieldset className="field-group">
        <legend className="section-title">{t('filterTitle')}</legend>
        <p className="page__subtitle">{t('filterHint')}</p>

        <label className="check-row">
          <input
            type="radio"
            name="categoryMode"
            checked={allCategories}
            onChange={() => setAllCategories(true)}
          />
          <span>{t('allCategories')}</span>
        </label>
        <label className="check-row">
          <input
            type="radio"
            name="categoryMode"
            checked={!allCategories}
            onChange={() => setAllCategories(false)}
          />
          <span>{t('customCategories')}</span>
        </label>

        {!allCategories ? (
          <div className="chip-grid" role="group" aria-label={t('customCategories')}>
            {PRODUCT_CATEGORIES.map((category) => (
              <label key={category} className="check-row check-row--chip">
                <input
                  type="checkbox"
                  checked={categories.includes(category)}
                  onChange={() => toggleValue(categories, category, setCategories)}
                />
                <span>{tc(`categories.${category}`)}</span>
              </label>
            ))}
          </div>
        ) : null}

        <label className="check-row" style={{ marginTop: '1rem' }}>
          <input
            type="radio"
            name="regionMode"
            checked={allRegions}
            onChange={() => setAllRegions(true)}
          />
          <span>{t('allRegions')}</span>
        </label>
        <label className="check-row">
          <input
            type="radio"
            name="regionMode"
            checked={!allRegions}
            onChange={() => setAllRegions(false)}
          />
          <span>{t('customRegions')}</span>
        </label>
        <p className="product-list__meta">{t('regionScopeHint')}</p>

        {!allRegions ? (
          <div className="chip-grid" role="group" aria-label={t('customRegions')}>
            {GEORGIA_REGIONS.map((region) => (
              <label key={region} className="check-row check-row--chip">
                <input
                  type="checkbox"
                  checked={regions.includes(region)}
                  onChange={() => toggleValue(regions, region, setRegions)}
                />
                <span>{tr(`regions.${region}`)}</span>
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

      {error ? <p className="form-error">{error}</p> : null}
      {saved ? <p className="form-success">{t('saved')}</p> : null}

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('save')}
      </button>
    </form>
  );
}
