'use client';

import { CATEGORY_DEFAULT_UNITS, PRODUCT_CATEGORIES, PRODUCT_UNITS } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

export function PurchaseRequestForm() {
  const t = useTranslations('purchaseRequests');
  const tc = useTranslations('catalog');
  const tp = useTranslations('product');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState<(typeof PRODUCT_CATEGORIES)[number]>('fruits');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get('title') ?? ''),
      category: String(form.get('category') ?? ''),
      quantity: String(form.get('quantity') ?? ''),
      unit: String(form.get('unit') ?? '') || undefined,
      variety: String(form.get('variety') ?? '') || undefined,
      packaging: String(form.get('packaging') ?? '') || undefined,
      destinationCountry: String(form.get('destinationCountry') ?? '') || undefined,
      message: String(form.get('message') ?? '') || undefined,
    };

    try {
      const response = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string; id?: string };
      if (!response.ok || !data.id) {
        setError(data.message ?? t('genericError'));
        return;
      }
      router.push(`/requests/${data.id}`);
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
        <span>{t('titleField')}</span>
        <input name="title" required maxLength={160} placeholder={t('titlePlaceholder')} />
      </label>

      <label className="field">
        <span>{t('category')}</span>
        <select
          name="category"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as (typeof PRODUCT_CATEGORIES)[number])
          }
          required
        >
          {PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {tc(`categories.${value}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="field-row">
        <label className="field">
          <span>{t('quantity')}</span>
          <input name="quantity" required maxLength={60} placeholder={t('quantityPlaceholder')} />
        </label>
        <label className="field">
          <span>{t('unit')}</span>
          <select name="unit" defaultValue={CATEGORY_DEFAULT_UNITS[category]}>
            <option value="">{tp('noUnit')}</option>
            {PRODUCT_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {tp(`units.${unit}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>
          {t('variety')} <span className="field__optional">{t('optional')}</span>
        </span>
        <input name="variety" maxLength={120} placeholder={t('varietyPlaceholder')} />
      </label>

      <label className="field">
        <span>
          {t('packaging')} <span className="field__optional">{t('optional')}</span>
        </span>
        <input name="packaging" maxLength={160} placeholder={t('packagingPlaceholder')} />
      </label>

      <label className="field">
        <span>
          {t('destinationCountry')} <span className="field__optional">{t('optional')}</span>
        </span>
        <input
          name="destinationCountry"
          maxLength={120}
          placeholder={t('destinationCountryPlaceholder')}
        />
      </label>

      <label className="field">
        <span>
          {t('message')} <span className="field__optional">{t('optional')}</span>
        </span>
        <textarea name="message" rows={4} maxLength={2000} placeholder={t('messagePlaceholder')} />
      </label>

      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('submit')}
      </button>
    </form>
  );
}
