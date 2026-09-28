'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  productId: string;
  className?: string;
};

export function DeleteProductButton({ productId, className = 'button button--ghost' }: Props) {
  const t = useTranslations('product');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (!window.confirm(t('deleteConfirm'))) {
      return;
    }
    setPending(true);
    const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    setPending(false);
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <button className={className} type="button" role="menuitem" onClick={onDelete} disabled={pending}>
      {pending ? t('pleaseWait') : t('delete')}
    </button>
  );
}
