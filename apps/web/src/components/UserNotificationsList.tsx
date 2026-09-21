'use client';

import type { UserNotificationItem } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

type Props = {
  initial: UserNotificationItem[];
  copyNamespace?: 'subscriptions' | 'notifications';
};

export function UserNotificationsList({ initial, copyNamespace = 'subscriptions' }: Props) {
  const t = useTranslations(copyNamespace);
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const emptyLabel = copyNamespace === 'notifications' ? t('empty') : t('inboxEmpty');
  const unreadLabel = copyNamespace === 'notifications' ? t('unread') : null;

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

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      router.refresh();
    } finally {
      setMarkingAll(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyLabel}</p>
      </div>
    );
  }

  const hasUnread = items.some((item) => !item.readAt);

  return (
    <div className="user-notifications-wrap">
      {hasUnread ? (
        <div className="user-notifications__toolbar">
          <button
            type="button"
            className="button button--ghost"
            disabled={markingAll}
            onClick={() => {
              void markAllRead();
            }}
          >
            {t('markAllRead')}
          </button>
        </div>
      ) : null}
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
                {unreadLabel && !item.readAt ? <span className="sr-only">{unreadLabel}</span> : null}
                <Link
                  href={item.href}
                  className="product-list__title"
                  onClick={() => void markRead(item.id)}
                >
                  {item.title}
                </Link>
                <p className="product-list__meta">{item.body}</p>
                <p className="product-list__meta">{created}</p>
              </div>
              {!item.readAt ? (
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={pendingId === item.id || markingAll}
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
    </div>
  );
}
