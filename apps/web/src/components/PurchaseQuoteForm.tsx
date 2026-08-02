'use client';

import { CURRENCIES, PRODUCT_UNITS } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  requestId: string;
  defaultQuantity?: string;
  defaultUnit?: string | null;
};

export function PurchaseQuoteForm({ requestId, defaultQuantity, defaultUnit }: Props) {
  const t = useTranslations('purchaseRequests');
  const tp = useTranslations('product');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      priceAmount: String(form.get('priceAmount') ?? ''),
      currency: String(form.get('currency') ?? 'GEL'),
      quantity: String(form.get('quantity') ?? '') || undefined,
      unit: String(form.get('unit') ?? '') || undefined,
      message: String(form.get('message') ?? '') || undefined,
    };

    try {
      const response = await fetch(`/api/purchase-requests/${requestId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
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
      <h2 className="section-title">{t('quoteTitle')}</h2>
      <p className="page__subtitle" style={{ marginBottom: '1rem' }}>
        {t('quoteSubtitle')}
      </p>
      <label className="field">
        <span>{t('price')}</span>
        <input name="priceAmount" required inputMode="decimal" placeholder="12.50" />
      </label>
      <label className="field">
        <span>{t('currency')}</span>
        <select name="currency" defaultValue="GEL">
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('quantity')}</span>
        <input name="quantity" defaultValue={defaultQuantity ?? ''} />
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
        <textarea name="message" rows={4} placeholder={t('quoteMessagePlaceholder')} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : t('submitQuote')}
      </button>
    </form>
  );
}
