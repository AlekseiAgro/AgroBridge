import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { REQUEST_PATHNAME_HEADER, REQUEST_SEARCH_HEADER } from './lib/protected-next-path';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  request.headers.set(REQUEST_PATHNAME_HEADER, request.nextUrl.pathname);
  request.headers.set(REQUEST_SEARCH_HEADER, request.nextUrl.search);
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(ka|en|ru|de|fr|it|es)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)'],
};
