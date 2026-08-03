'use client';

import {
  HARVEST_STATUSES,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  SEASON_MONTHS,
  defaultUnitForCategory,
  type HarvestStatus,
  type ProductDetail,
  type ProductUnit,
  type SeasonMonth,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  mode: 'create' | 'edit';
  initial?: ProductDetail | null;
};

function parseOptionalQuantity(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function ProductForm({ mode, initial }: Props) {
  const t = useTranslations('product');
  const th = useTranslations('harvest');
  const tc = useTranslations('catalog');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [unitTouched, setUnitTouched] = useState(Boolean(initial?.unit));
  const [seasonMonths, setSeasonMonths] = useState<SeasonMonth[]>(
    (initial?.seasonMonths ?? []) as SeasonMonth[],
  );
  const [harvestStatus, setHarvestStatus] = useState<HarvestStatus | ''>(
    initial?.harvestStatus ?? '',
  );
  const [preorderEnabled, setPreorderEnabled] = useState(
    initial?.preorderEnabled ?? false,
  );

  const suggestedUnit = useMemo(
    () => defaultUnitForCategory(category) ?? '',
    [category],
  );

  function toggleMonth(month: SeasonMonth) {
    setSeasonMonths((prev) =>
      prev.includes(month) ? prev.filter((item) => item !== month) : [...prev, month].sort((a, b) => a - b),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const minQuantity = parseOptionalQuantity(form.get('minQuantity'));
    const maxQuantity = parseOptionalQuantity(form.get('maxQuantity'));
    const forecastQuantity = parseOptionalQuantity(form.get('forecastQuantity'));
    if (
      Number.isNaN(minQuantity) ||
      Number.isNaN(maxQuantity) ||
      Number.isNaN(forecastQuantity)
    ) {
      setError(t('quantityInvalid'));
      setPending(false);
      return;
    }
    if (minQuantity != null && maxQuantity != null && minQuantity > maxQuantity) {
      setError(t('quantityRangeInvalid'));
      setPending(false);
      return;
    }

    const harvestStartAt = String(form.get('harvestStartAt') ?? '').trim() || null;
    const harvestEndAt = String(form.get('harvestEndAt') ?? '').trim() || null;

    const payload = {
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      category: String(form.get('category') ?? '') || undefined,
      unit: String(form.get('unit') ?? '') || undefined,
      minQuantity,
      maxQuantity,
      seasonMonths,
      harvestStartAt,
      harvestEndAt,
      forecastQuantity,
      harvestStatus: harvestStatus || null,
      preorderEnabled,
      isPublished: form.get('isPublished') === 'on',
    };

    try {
      const response = await fetch(
        mode === 'create' ? '/api/products' : `/api/products/${initial?.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { message?: string; id?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      if (mode === 'create' && data.id) {
        router.replace(`/dashboard/products/${data.id}/edit`);
      } else {
        router.replace('/dashboard/products');
      }
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('title')}</span>
        <input name="title" required minLength={2} defaultValue={initial?.title ?? ''} />
      </label>
      <label className="field">
        <span>{t('description')}</span>
        <textarea name="description" rows={5} defaultValue={initial?.description ?? ''} />
      </label>
      <label className="field">
        <span>{t('category')}</span>
        <select
          name="category"
          value={category}
          onChange={(event) => {
            const nextCategory = event.target.value;
            setCategory(nextCategory);
            if (!unitTouched) {
              setUnit(defaultUnitForCategory(nextCategory) ?? '');
            }
          }}
        >
          <option value="">{tc('allCategories')}</option>
          {PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {tc(`categories.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('unit')}</span>
        <select
          name="unit"
          value={unit}
          onChange={(event) => {
            setUnitTouched(true);
            setUnit(event.target.value);
          }}
        >
          <option value="">{t('noUnit')}</option>
          {PRODUCT_UNITS.map((value) => (
            <option key={value} value={value}>
              {t(`units.${value}`)}
              {suggestedUnit === value ? ` (${t('unitSuggested')})` : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t('minQuantity')}</span>
          <input
            name="minQuantity"
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            placeholder={t('minQuantityPlaceholder')}
            defaultValue={initial?.minQuantity ?? ''}
          />
        </label>
        <label className="field">
          <span>{t('maxQuantity')}</span>
          <input
            name="maxQuantity"
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            placeholder={t('maxQuantityPlaceholder')}
            defaultValue={initial?.maxQuantity ?? ''}
          />
        </label>
      </div>
      <p className="field-hint">
        {t('quantityHint', {
          unit: unit
            ? t(`units.${unit as ProductUnit}`)
            : suggestedUnit
              ? t(`units.${suggestedUnit as ProductUnit}`)
              : t('noUnit'),
        })}
      </p>

      <fieldset className="field-group harvest-form">
        <legend className="section-title">{th('formTitle')}</legend>
        <p className="page__subtitle">{th('formSubtitle')}</p>

        <div className="field">
          <span>{th('seasonality')}</span>
          <div className="chip-grid">
            {SEASON_MONTHS.map((month) => (
              <label key={month} className="check-row check-row--chip">
                <input
                  type="checkbox"
                  checked={seasonMonths.includes(month)}
                  onChange={() => toggleMonth(month)}
                />
                <span>{th(`months.${month}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>{th('startDate')}</span>
            <input
              name="harvestStartAt"
              type="date"
              defaultValue={toDateInput(initial?.harvestStartAt)}
            />
          </label>
          <label className="field">
            <span>{th('endDate')}</span>
            <input
              name="harvestEndAt"
              type="date"
              defaultValue={toDateInput(initial?.harvestEndAt)}
            />
          </label>
        </div>

        <label className="field">
          <span>{th('forecast')}</span>
          <input
            name="forecastQuantity"
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            placeholder={th('forecastPlaceholder')}
            defaultValue={initial?.forecastQuantity ?? ''}
          />
        </label>

        <label className="field">
          <span>{th('statusLabel')}</span>
          <select
            value={harvestStatus}
            onChange={(event) =>
              setHarvestStatus(event.target.value as HarvestStatus | '')
            }
          >
            <option value="">{th('statusUnset')}</option>
            {HARVEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {th(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="role-option">
          <input
            type="checkbox"
            checked={preorderEnabled}
            onChange={(event) => setPreorderEnabled(event.target.checked)}
          />
          <span>{th('preorderEnable')}</span>
        </label>
      </fieldset>

      <label className="role-option">
        <input name="isPublished" type="checkbox" defaultChecked={initial?.isPublished ?? false} />
        <span>{t('submitForReview')}</span>
      </label>
      {initial?.moderationStatus ? (
        <p className="product-list__meta">
          {t('moderationLabel')}: {t(`moderation.${initial.moderationStatus}`)}
          {initial.moderationNote ? ` — ${initial.moderationNote}` : ''}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : mode === 'create' ? t('createSubmit') : t('saveSubmit')}
      </button>
    </form>
  );
}
