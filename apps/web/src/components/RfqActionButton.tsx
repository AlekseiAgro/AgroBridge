'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { requestInboxUnreadRefresh } from '@/components/InboxNavLink';
import { useRouter } from '@/i18n/navigation';

type Action = 'accept' | 'decline' | 'cancel' | 'complete';

type Props = {
  rfqId: string;
  action: Action;
  variant?: 'primary' | 'ghost';
};

export function RfqActionButton({ rfqId, action, variant = 'ghost' }: Props) {
  const t = useTranslations('rfq');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/rfqs/${rfqId}/${action}`, { method: 'POST' });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      requestInboxUnreadRefresh();
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        className={`button button--${variant}`}
        type="button"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? t('pleaseWait') : t(`actions.${action}`)}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
