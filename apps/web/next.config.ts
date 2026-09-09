import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
).replace(/\/api\/?$/, '');

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@agrobridge/shared'],
  async rewrites() {
    return [
      {
        // Local/legacy public media only. Future R2/CDN URLs use
        // STORAGE_PUBLIC_BASE_URL/{key} and must not be routed through here.
        source: '/api/uploads/:path*',
        destination: `${apiOrigin}/api/uploads/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
