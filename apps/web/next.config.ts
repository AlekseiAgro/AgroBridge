import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiOrigin = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'
).replace(/\/api\/?$/, '');

const nextConfig: NextConfig = {
  transpilePackages: ['@agrobridge/shared'],
  async rewrites() {
    return [
      {
        source: '/api/uploads/:path*',
        destination: `${apiOrigin}/api/uploads/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
