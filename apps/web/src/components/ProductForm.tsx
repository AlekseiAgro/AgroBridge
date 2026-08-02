'use client';

import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  type ProductDetail,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  mode: 'create' | 'edit';
  initial?: ProductDetail | null;
};

export function ProductForm({ mode, initial }: Props) {
  const t = useTranslations('product');
  const tc = useTranslations('catalog');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      category: String(form.get('category') ?? '') || undefined,
      unit: String(form.get('unit') ?? '') || undefined,
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
      router.replace('/dashboard/products');
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
        <select name="category" defaultValue={initial?.category ?? ''}>
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
        <select name="unit" defaultValue={initial?.unit ?? ''}>
          <option value="">{t('noUnit')}</option>
          {PRODUCT_UNITS.map((value) => (
            <option key={value} value={value}>
              {t(`units.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="role-option">
        <input name="isPublished" type="checkbox" defaultChecked={initial?.isPublished ?? false} />
        <span>{t('publish')}</span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : mode === 'create' ? t('createSubmit') : t('saveSubmit')}
      </button>
    </form>
  );
}
