'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  userId: string;
  blocked: boolean;
};

export function UserBlockActions({ userId, blocked }: Props) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function run() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/users/${userId}/${blocked ? 'unblock' : 'block'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: blocked ? undefined : JSON.stringify({ reason }),
        },
      );
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
      {!blocked ? (
        <label className="field">
          <span>{t('users.blockReason')}</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('users.blockReasonPlaceholder')}
          />
        </label>
      ) : null}
      <div className="product-list__actions">
        <button
          className={blocked ? 'button button--primary' : 'button button--ghost'}
          type="button"
          disabled={pending}
          onClick={() => run()}
        >
          {pending
            ? t('pleaseWait')
            : blocked
              ? t('users.unblock')
              : t('users.block')}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
