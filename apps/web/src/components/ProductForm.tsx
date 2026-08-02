'use client';

import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  defaultUnitForCategory,
  type ProductDetail,
  type ProductUnit,
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

export function ProductForm({ mode, initial }: Props) {
  const t = useTranslations('product');
  const tc = useTranslations('catalog');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [unitTouched, setUnitTouched] = useState(Boolean(initial?.unit));

  const suggestedUnit = useMemo(
    () => defaultUnitForCategory(category) ?? '',
    [category],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const minQuantity = parseOptionalQuantity(form.get('minQuantity'));
    const maxQuantity = parseOptionalQuantity(form.get('maxQuantity'));
    if (Number.isNaN(minQuantity) || Number.isNaN(maxQuantity)) {
      setError(t('quantityInvalid'));
      setPending(false);
      return;
    }
    if (minQuantity != null && maxQuantity != null && minQuantity > maxQuantity) {
      setError(t('quantityRangeInvalid'));
      setPending(false);
      return;
    }

    const payload = {
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      category: String(form.get('category') ?? '') || undefined,
      unit: String(form.get('unit') ?? '') || undefined,
      minQuantity,
      maxQuantity,
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
