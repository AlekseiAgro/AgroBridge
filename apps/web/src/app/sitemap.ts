import type { MetadataRoute } from 'next';
import { apiRequest } from '@/lib/api';
import { buildPublicSitemap } from '@/lib/seo-sitemap';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildPublicSitemap((path) => apiRequest(path));
}
