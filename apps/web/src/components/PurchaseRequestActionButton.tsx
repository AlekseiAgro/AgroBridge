'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Action = 'cancel' | 'close' | 'accept' | 'decline' | 'withdraw';

type Props = {
  requestId: string;
  action: Action;
  quoteId?: string;
  variant?: 'primary' | 'ghost';
};

export function PurchaseRequestActionButton({
  requestId,
  action,
  quoteId,
  variant = 'ghost',
}: Props) {
  const t = useTranslations('purchaseRequests');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);

    const path =
      action === 'cancel' || action === 'close'
        ? `/api/purchase-requests/${requestId}/${action}`
        : `/api/purchase-requests/${requestId}/quotes/${quoteId}/${action}`;

    try {
      const response = await fetch(path, { method: 'POST' });
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

  const labels: Record<Action, string> = {
    cancel: t('actions.cancel'),
    close: t('actions.close'),
    accept: t('actions.accept'),
    decline: t('actions.decline'),
    withdraw: t('actions.withdraw'),
  };

  return (
    <div>
      <button
        className={variant === 'primary' ? 'button button--primary' : 'button button--ghost'}
        type="button"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? t('pleaseWait') : labels[action]}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
