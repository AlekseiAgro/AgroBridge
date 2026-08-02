'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  rfqId?: string;
  purchaseRequestId?: string;
  farmerId?: string;
  buyerId?: string;
  label?: string;
  variant?: 'primary' | 'ghost';
};

export function OpenChatButton({
  rfqId,
  purchaseRequestId,
  farmerId,
  buyerId,
  label,
  variant = 'primary',
}: Props) {
  const t = useTranslations('chat');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      if (rfqId) payload.rfqId = rfqId;
      if (purchaseRequestId) payload.purchaseRequestId = purchaseRequestId;
      if (farmerId) payload.farmerId = farmerId;
      if (buyerId) payload.buyerId = buyerId;

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string; id?: string };
      if (!response.ok || !data.id) {
        setError(data.message ?? t('genericError'));
        return;
      }
      router.push(`/dashboard/chat/${data.id}`);
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        className={variant === 'ghost' ? 'button button--ghost' : 'button button--primary'}
        type="button"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? t('pleaseWait') : label || t('openChat')}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
