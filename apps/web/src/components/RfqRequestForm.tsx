'use client';

import { PRODUCT_UNITS } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  productId: string;
  defaultUnit?: string | null;
  preorder?: boolean;
};

export function RfqRequestForm({ productId, defaultUnit, preorder = false }: Props) {
  const t = useTranslations('rfq');
  const tp = useTranslations('product');
  const th = useTranslations('harvest');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const message = String(form.get('message') ?? '').trim();
    const payload = {
      productId,
      quantity: String(form.get('quantity') ?? ''),
      unit: String(form.get('unit') ?? '') || undefined,
      message: preorder
        ? [`[Pre-order] ${th('preorderMessagePrefix')}`, message].filter(Boolean).join('\n')
        : message,
    };

    try {
      const response = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string; id?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      router.push(`/dashboard/rfqs/${data.id}`);
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <h2 className="section-title">
        {preorder ? th('preorderRequestTitle') : t('requestTitle')}
      </h2>
      <p className="page__subtitle">
        {preorder ? th('preorderRequestSubtitle') : t('requestSubtitle')}
      </p>
      <label className="field">
        <span>{t('quantity')}</span>
        <input name="quantity" required minLength={1} placeholder="500" />
      </label>
      <label className="field">
        <span>{t('unit')}</span>
        <select name="unit" defaultValue={defaultUnit ?? ''}>
          <option value="">{tp('noUnit')}</option>
          {PRODUCT_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {tp(`units.${unit}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('message')}</span>
        <textarea name="message" rows={4} placeholder={t('messagePlaceholder')} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('submitRequest')}
      </button>
    </form>
  );
}
