'use client';

import type { PendingInboxCount } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';

export const INBOX_UNREAD_REFRESH_EVENT = 'agrobridge:inbox-unread-refresh';

export function requestInboxUnreadRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(INBOX_UNREAD_REFRESH_EVENT));
  }
}

type Props = {
  className?: string;
  /** Server-fetched count so the badge appears before the first client poll. */
  initialCount?: number;
};

function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function InboxNavLink({ className, initialCount = 0 }: Props) {
  const t = useTranslations('nav');
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/rfqs/inbox/unread-count', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const data = (await response.json()) as PendingInboxCount;
        if (!cancelled) {
          setCount(typeof data.count === 'number' ? Math.max(0, data.count) : 0);
        }
      } catch {
        // ignore polling errors — keep last known count
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 8000);

    function onFocus() {
      void load();
    }
    function onRefresh() {
      void load();
    }

    window.addEventListener('focus', onFocus);
    window.addEventListener(INBOX_UNREAD_REFRESH_EVENT, onRefresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(INBOX_UNREAD_REFRESH_EVENT, onRefresh);
    };
  }, []);

  const text = t('inbox');

  return (
    <Link
      href="/dashboard/inbox"
      className={['chat-nav-link', count > 0 ? 'chat-nav-link--has-unread' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={count > 0 ? t('inboxUnread', { count }) : text}
    >
      <span className="chat-nav-link__label">{text}</span>
      {count > 0 ? (
        <span className="chat-nav-link__badge" aria-hidden>
          {formatCount(count)}
        </span>
      ) : null}
    </Link>
  );
}
