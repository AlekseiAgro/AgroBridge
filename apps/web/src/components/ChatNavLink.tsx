'use client';

import type { UnreadMessagesCount } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';

export const CHAT_UNREAD_REFRESH_EVENT = 'agrobridge:chat-unread-refresh';

export function requestChatUnreadRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHAT_UNREAD_REFRESH_EVENT));
  }
}

type Props = {
  className?: string;
  /** Server-fetched count so the badge appears before the first client poll. */
  initialCount?: number;
  /** Optional label override (defaults to nav.chat). */
  label?: string;
};

function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function ChatNavLink({ className, initialCount = 0, label }: Props) {
  const t = useTranslations('nav');
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/conversations/unread-count', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const data = (await response.json()) as UnreadMessagesCount;
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
    window.addEventListener(CHAT_UNREAD_REFRESH_EVENT, onRefresh);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(CHAT_UNREAD_REFRESH_EVENT, onRefresh);
    };
  }, []);

  const text = label ?? t('chat');

  return (
    <Link
      href="/dashboard/chat"
      className={['chat-nav-link', count > 0 ? 'chat-nav-link--has-unread' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={count > 0 ? t('chatUnread', { count }) : text}
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

/** Compact unread pill for cards / buttons that already link elsewhere. */
export function ChatUnreadBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span className={className ? `chat-nav-link__badge ${className}` : 'chat-nav-link__badge'}>
      {formatCount(count)}
    </span>
  );
}
