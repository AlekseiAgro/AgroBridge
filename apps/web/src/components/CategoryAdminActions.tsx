'use client';

import type { CategoryConfigItem } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  categories: CategoryConfigItem[];
};

export function CategoryAdminActions({ categories }: Props) {
  const t = useTranslations('admin');
  const tc = useTranslations('catalog');
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(category: CategoryConfigItem) {
    setPendingId(category.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !category.enabled }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      {error ? <p className="form-error">{error}</p> : null}
      <ul className="product-list">
        {categories.map((category) => (
          <li key={category.id} className="product-list__item">
            <p className="product-list__title">
              {tc(`categories.${category.id as 'fruits'}`)}
            </p>
            <p className="product-list__meta">
              {category.enabled ? t('categories.enabled') : t('categories.disabled')}
              {' · '}
              {t('categories.sortOrder')}: {category.sortOrder}
            </p>
            <div className="product-list__actions">
              <button
                className={
                  category.enabled ? 'button button--ghost' : 'button button--primary'
                }
                type="button"
                disabled={pendingId === category.id}
                onClick={() => toggle(category)}
              >
                {pendingId === category.id
                  ? t('pleaseWait')
                  : category.enabled
                    ? t('categories.disable')
                    : t('categories.enable')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
