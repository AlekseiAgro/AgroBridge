'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { loadMetaPixel, trackMetaPageView } from '@/lib/meta-pixel';

/** Mounted only after advertising consent; sends PageView for every route change. */
export function MetaPixelPageViews({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => {
    loadMetaPixel(pixelId);
    trackMetaPageView(pathname, query ? `?${query}` : '');
  }, [pixelId, pathname, query]);

  return null;
}
