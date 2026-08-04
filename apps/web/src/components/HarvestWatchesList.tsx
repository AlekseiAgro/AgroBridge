'use client';

import type { HarvestWatchItem } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { HarvestStatusBadge } from '@/components/HarvestStatusBadge';
import { RatingStars } from '@/components/RatingStars';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { Link, useRouter } from '@/i18n/navigation';
import { formatRegionLabel } from '@/lib/region';
import { formatProductTitle } from '@/lib/product-title';
import { toPublicMediaUrl } from '@/lib/product-image';

type Props = {
  initial: HarvestWatchItem[];
};

export function HarvestWatchesList({ initial }: Props) {
  const t = useTranslations('subscriptions');
  const th = useTranslations('harvest');
  const tc = useTranslations('catalog');
  const tp = useTranslations('product');
  const tr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

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
        {items.map((item) => {
          const imageUrl = item.imageUrl ? toPublicMediaUrl(item.imageUrl) : null;
          const ownerLabel = item.owner.displayName?.trim() || tp('sellerFallback');
          return (
            <li key={item.id} className="harvest-watches__item product-list__item--with-media">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="product-list__media" />
              ) : (
                <div className="product-list__media product-list__media--empty" aria-hidden />
              )}
              <div className="harvest-watches__body">
                <Link href={`/products/${item.productId}`} className="product-list__title">
                  {formatProductTitle(item.productTitle, locale)}
                </Link>
                <p className="product-list__meta">
                  {item.farm ? (
                    <>
                      <Link href={`/farms/${item.farm.id}`}>{item.farm.name}</Link>
                      <VerifiedBadge verified={item.farm.verified} />
                      {item.farm.region
                        ? ` · ${formatRegionLabel(item.farm.region, tr) ?? item.farm.region}`
                        : null}
                      {' · '}
                    </>
                  ) : null}
                  <Link href={`/users/${item.owner.id}`}>{ownerLabel}</Link>
                </p>
                <div className="product-list__rating">
                  <span className="product-list__rating-label">{tc('sellerRating')}</span>
                  <RatingStars
                    value={item.sellerRating.average}
                    count={item.sellerRating.count}
                    size="sm"
                    reviewsHref={`/users/${item.owner.id}/reviews`}
                  />
                </div>
                <HarvestStatusBadge
                  status={item.harvestStatus}
                  preorderEnabled={item.preorderEnabled}
                />
                <div className="harvest-watches__actions">
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
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
