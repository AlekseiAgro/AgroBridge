'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  productId: string;
};

export function ModerationActions({ productId }: Props) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function run(action: 'approve' | 'reject') {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${productId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ note }) : undefined,
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
      setPending(null);
    }
  }

  return (
    <div className="moderation-actions">
      <label className="field">
        <span>{t('rejectNote')}</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('rejectNotePlaceholder')}
        />
      </label>
      <div className="product-list__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={pending !== null}
          onClick={() => run('approve')}
        >
          {pending === 'approve' ? t('pleaseWait') : t('approve')}
        </button>
        <button
          className="button button--ghost"
          type="button"
          disabled={pending !== null}
          onClick={() => run('reject')}
        >
          {pending === 'reject' ? t('pleaseWait') : t('reject')}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
