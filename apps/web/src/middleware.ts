import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { NEXT_LOCALE_COOKIE, bareRootRedirectPath } from './lib/bare-root-redirect';
import { REQUEST_PATHNAME_HEADER, REQUEST_SEARCH_HEADER } from './lib/protected-next-path';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  request.headers.set(REQUEST_PATHNAME_HEADER, request.nextUrl.pathname);
  request.headers.set(REQUEST_SEARCH_HEADER, request.nextUrl.search);

  const rootRedirect = bareRootRedirectPath(
    request.nextUrl.pathname,
    request.cookies.get(NEXT_LOCALE_COOKIE)?.value,
  );
  if (rootRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = rootRedirect;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(ka|en|ru|de|fr|it|es)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)'],
};
