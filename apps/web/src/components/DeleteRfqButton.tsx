'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  rfqId: string;
};

export function DeleteRfqButton({ rfqId }: Props) {
  const t = useTranslations('rfq');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!window.confirm(t('deleteConfirm'))) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch(`/api/rfqs/${rfqId}`, { method: 'DELETE' });
      if (!response.ok) {
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="rfq-delete-button"
      type="button"
      onClick={onDelete}
      disabled={pending}
      aria-label={t('delete')}
      title={t('delete')}
    >
      <svg
        className="rfq-delete-button__icon"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9zm-1 12h12a1 1 0 0 0 1-1V8H5v12a1 1 0 0 0 1 1z"
        />
      </svg>
    </button>
  );
}
