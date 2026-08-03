'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  requestId: string;
};

export function RequestModerateActions({ requestId }: Props) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function run() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/purchase-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
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
    <div className="moderation-actions">
      <label className="field">
        <span>{t('requests.cancelNote')}</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('requests.cancelNotePlaceholder')}
        />
      </label>
      <div className="product-list__actions">
        <button
          className="button button--ghost"
          type="button"
          disabled={pending}
          onClick={() => run()}
        >
          {pending ? t('pleaseWait') : t('requests.cancel')}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
