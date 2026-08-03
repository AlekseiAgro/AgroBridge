'use client';

import type { UnreadMessagesCount } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';

type Props = {
  className?: string;
};

function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function ChatNavLink({ className }: Props) {
  const t = useTranslations('nav');
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/conversations/unread-count', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as UnreadMessagesCount;
        if (!cancelled) {
          setCount(typeof data.count === 'number' ? data.count : 0);
        }
      } catch {
        // ignore polling errors
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 15000);

    function onFocus() {
      void load();
    }
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <Link
      href="/dashboard/chat"
      className={className ? `chat-nav-link ${className}` : 'chat-nav-link'}
      aria-label={count > 0 ? t('chatUnread', { count }) : t('chat')}
    >
      <span>{t('chat')}</span>
      {count > 0 ? (
        <span className="chat-nav-link__badge" aria-hidden>
          {formatCount(count)}
        </span>
      ) : null}
    </Link>
  );
}
