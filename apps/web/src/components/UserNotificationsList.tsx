'use client';

import type { UserNotificationItem } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

type Props = {
  initial: UserNotificationItem[];
};

export function UserNotificationsList({ initial }: Props) {
  const t = useTranslations('subscriptions');
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  async function markRead(id: string) {
    setPendingId(id);
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
        ),
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (items.length === 0) {
    return <p className="empty-state">{t('inboxEmpty')}</p>;
  }

  return (
    <ul className="user-notifications">
      {items.map((item) => {
        const created = new Date(item.createdAt).toLocaleString(locale);
        return (
          <li
            key={item.id}
            className={
              item.readAt
                ? 'user-notifications__item'
                : 'user-notifications__item user-notifications__item--unread'
            }
          >
            <div className="user-notifications__main">
              <Link href={item.href} className="product-list__title" onClick={() => void markRead(item.id)}>
                {item.title}
              </Link>
              <p className="product-list__meta">{item.body}</p>
              <p className="product-list__meta">{created}</p>
            </div>
            {!item.readAt ? (
              <button
                type="button"
                className="button button--ghost"
                disabled={pendingId === item.id}
                onClick={() => {
                  void markRead(item.id);
                }}
              >
                {t('markRead')}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
