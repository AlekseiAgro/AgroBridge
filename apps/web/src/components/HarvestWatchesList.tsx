'use client';

import type { HarvestWatchItem } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { formatProductTitle } from '@/lib/product-title';

type Props = {
  initial: HarvestWatchItem[];
};

export function HarvestWatchesList({ initial }: Props) {
  const t = useTranslations('subscriptions');
  const th = useTranslations('harvest');
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unwatch(productId: string) {
    setPendingId(productId);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/watch`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('harvestWatchError'));
        return;
      }
      setItems((prev) => prev.filter((item) => item.productId !== productId));
      router.refresh();
    } catch {
      setError(t('harvestWatchError'));
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="empty-state">{t('harvestWatchesEmpty')}</p>;
  }

  return (
    <div className="harvest-watches">
      <ul className="harvest-watches__list">
        {items.map((item) => (
          <li key={item.id} className="harvest-watches__item">
            <div className="harvest-watches__main">
              <Link href={`/products/${item.productId}`} className="product-list__title">
                {formatProductTitle(item.productTitle, locale)}
              </Link>
              <p className="product-list__meta">
                {item.farmName ? `${item.farmName} · ` : null}
                {item.harvestStatus
                  ? th(`status.${item.harvestStatus}`)
                  : th('statusUnset')}
                {item.preorderEnabled ? ` · ${th('preorderBadge')}` : null}
              </p>
            </div>
            <button
              type="button"
              className="button button--ghost"
              disabled={pendingId === item.productId}
              onClick={() => {
                void unwatch(item.productId);
              }}
            >
              {pendingId === item.productId ? t('pleaseWait') : th('unwatch')}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
