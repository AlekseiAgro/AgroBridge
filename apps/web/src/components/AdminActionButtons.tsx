'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  endpoint: string;
  approveLabel?: string;
  rejectLabel?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  showNote?: boolean;
};

export function AdminActionButtons({
  endpoint,
  approveLabel,
  rejectLabel,
  noteLabel,
  notePlaceholder,
  showNote = true,
}: Props) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function run(action: 'approve' | 'reject') {
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`${endpoint}/${action}`, {
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
      setPending(null);
    }
  }

  return (
    <div className="moderation-actions">
      {showNote ? (
        <label className="field">
          <span>{noteLabel ?? t('rejectNote')}</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={notePlaceholder ?? t('rejectNotePlaceholder')}
          />
        </label>
      ) : null}
      <div className="product-list__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={pending !== null}
          onClick={() => run('approve')}
        >
          {pending === 'approve' ? t('pleaseWait') : (approveLabel ?? t('approve'))}
        </button>
        <button
          className="button button--ghost"
          type="button"
          disabled={pending !== null}
          onClick={() => run('reject')}
        >
          {pending === 'reject' ? t('pleaseWait') : (rejectLabel ?? t('reject'))}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
