import type { MetadataRoute } from 'next';
import { PRODUCTION_SITEMAP_URL, robotsDisallowPaths } from '@/lib/seo-robots';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: robotsDisallowPaths(),
    },
    sitemap: PRODUCTION_SITEMAP_URL,
  };
}
