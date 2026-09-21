'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import {
  purchaseRequestActionRequiresConfirm,
  resolvePurchaseRequestActionRequest,
  type PurchaseRequestAction,
} from '@/lib/purchase-request-action';

type Props = {
  requestId: string;
  action: PurchaseRequestAction;
  quoteId?: string;
  variant?: 'primary' | 'ghost' | 'danger-quiet';
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
    const next = resolvePurchaseRequestActionRequest({
      action,
      requestId,
      quoteId,
      confirmMessage: purchaseRequestActionRequiresConfirm(action) ? t(`confirm.${action}`) : '',
      confirm: (message) => window.confirm(message),
    });
    if (!next.proceed) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(next.path, { method: next.method });
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

  const labels: Record<PurchaseRequestAction, string> = {
    cancel: t('actions.cancel'),
    close: t('actions.close'),
    accept: t('actions.accept'),
    decline: t('actions.decline'),
    withdraw: t('actions.withdraw'),
  };

  const buttonClass =
    variant === 'primary'
      ? 'button button--primary'
      : variant === 'danger-quiet'
        ? 'button button--danger-quiet'
        : 'button button--ghost';

  return (
    <div>
      <button
        className={buttonClass}
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
