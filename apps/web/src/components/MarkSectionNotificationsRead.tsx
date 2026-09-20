'use client';

import { PURCHASE_REQUEST_UNREAD_TYPES, QUOTE_UNREAD_TYPES } from '@agrobridge/shared';
import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';

const SECTION_TYPES = {
  'purchase-requests': PURCHASE_REQUEST_UNREAD_TYPES,
  quotes: QUOTE_UNREAD_TYPES,
} as const;

type Props = {
  section: keyof typeof SECTION_TYPES;
};

export function MarkSectionNotificationsRead({ section }: Props) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const types = [...SECTION_TYPES[section]];

    void (async () => {
      try {
        const response = await fetch('/api/notifications/read-types', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ types }),
        });
        if (response.ok) {
          router.refresh();
        }
      } catch {
        // Badge counts refresh on the next navigation.
      }
    })();
  }, [section, router]);

  return null;
}
