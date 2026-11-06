'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { syncMetaPixel } from '@/lib/meta-pixel';

/** Mounted only after advertising consent; runs the Pixel for every route change. */
export function MetaPixelPageViews({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => {
    syncMetaPixel(pixelId, {
      pathname,
      search: query ? `?${query}` : '',
      hash: window.location.hash,
      referrer: document.referrer,
    });
  }, [pixelId, pathname, query]);

  return null;
}
