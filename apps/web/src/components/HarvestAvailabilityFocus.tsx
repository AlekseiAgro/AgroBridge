'use client';

import { useEffect } from 'react';
import {
  HARVEST_STATUS_FOCUS_CLASS,
  HARVEST_STATUS_FOCUS_HASH,
  HARVEST_STATUS_FOCUS_MS,
  HARVEST_STATUS_ID,
} from '@/lib/harvest-availability-focus';

/**
 * One-shot scroll and highlight when the edit page is opened with the
 * Update availability fragment. The fragment is removed immediately so a
 * refresh, Save, or a later visit does not replay the highlight.
 */
export function HarvestAvailabilityFocus() {
  useEffect(() => {
    if (window.location.hash !== HARVEST_STATUS_FOCUS_HASH) {
      return;
    }

    let timeoutId = 0;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(HARVEST_STATUS_ID);
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }

      const nextUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(window.history.state, '', nextUrl);
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      target.focus({ preventScroll: true });
      target.classList.add(HARVEST_STATUS_FOCUS_CLASS);
      timeoutId = window.setTimeout(() => {
        target.classList.remove(HARVEST_STATUS_FOCUS_CLASS);
      }, HARVEST_STATUS_FOCUS_MS);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeoutId);
      document.getElementById(HARVEST_STATUS_ID)?.classList.remove(HARVEST_STATUS_FOCUS_CLASS);
    };
  }, []);

  return null;
}
