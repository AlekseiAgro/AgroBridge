'use client';

import type { HarvestStatus } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { DeleteProductButton } from '@/components/DeleteProductButton';
import { Link, useRouter } from '@/i18n/navigation';
import { HARVEST_STATUS_FOCUS_HASH } from '@/lib/harvest-availability-focus';

type Props = {
  productId: string;
  harvestStatus: HarvestStatus | null;
};

export function MyProductCardActions({ productId, harvestStatus }: Props) {
  const t = useTranslations('product');
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [pending, setPending] = useState(false);
  const editHref = `/dashboard/products/${productId}/edit`;
  const availabilityHref = `${editHref}${HARVEST_STATUS_FOCUS_HASH}`;
  const showMarkSoldOut = harvestStatus !== 'soldOut';

  function closeMenu() {
    menuRef.current?.removeAttribute('open');
  }

  async function onMarkSoldOut() {
    if (!window.confirm(t('markSoldOutConfirm'))) {
      return;
    }
    closeMenu();
    setPending(true);
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ harvestStatus: 'soldOut' }),
      });
      if (!response.ok) {
        window.alert(t('genericError'));
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="product-list__actions">
      <Link
        className="button button--primary product-list__action--primary"
        href={availabilityHref}
      >
        {t('updateAvailability')}
      </Link>
      <details ref={menuRef} className="mine-card-menu">
        <summary
          className="button button--ghost mine-card-menu__trigger"
          aria-label={t('moreActions')}
          aria-haspopup="menu"
        >
          <span aria-hidden="true">⋯</span>
        </summary>
        <div className="mine-card-menu__panel" role="menu" aria-label={t('moreActions')}>
          <Link className="mine-card-menu__item" href={editHref} role="menuitem" onClick={closeMenu}>
            {t('edit')}
          </Link>
          {showMarkSoldOut ? (
            <button
              className="mine-card-menu__item"
              type="button"
              role="menuitem"
              onClick={onMarkSoldOut}
              disabled={pending}
            >
              {pending ? t('pleaseWait') : t('markSoldOut')}
            </button>
          ) : null}
          <DeleteProductButton
            productId={productId}
            className="mine-card-menu__item mine-card-menu__item--danger"
          />
        </div>
      </details>
    </div>
  );
}
