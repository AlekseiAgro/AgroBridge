'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  productId: string;
};

export function DeleteProductButton({ productId }: Props) {
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
    <button className="button button--ghost" type="button" onClick={onDelete} disabled={pending}>
      {pending ? t('pleaseWait') : t('delete')}
    </button>
  );
}
