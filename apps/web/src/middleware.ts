import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import {
  NEXT_LOCALE_COOKIE,
  bareRootRedirectPath,
  bareRootRedirectStatus,
} from './lib/bare-root-redirect';
import { REQUEST_PATHNAME_HEADER, REQUEST_SEARCH_HEADER } from './lib/protected-next-path';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  request.headers.set(REQUEST_PATHNAME_HEADER, request.nextUrl.pathname);
  request.headers.set(REQUEST_SEARCH_HEADER, request.nextUrl.search);

  const cookieLocale = request.cookies.get(NEXT_LOCALE_COOKIE)?.value;
  const rootRedirect = bareRootRedirectPath(request.nextUrl.pathname, cookieLocale);
  if (rootRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = rootRedirect;
    const response = NextResponse.redirect(url, bareRootRedirectStatus(cookieLocale));
    // The target depends on the cookie, so browsers must not cache this hop.
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const response = intlMiddleware(request);
  if (request.nextUrl.pathname.split('/').includes('reset-password')) {
    // The URL carries a one-time reset token; no request leaving this page
    // (links, assets, a link opened in a new tab) may report it as the referrer.
    response.headers.set('Referrer-Policy', 'no-referrer');
  }
  return response;
}

export const config = {
  matcher: ['/', '/(ka|en|ru|de|fr|it|es)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)'],
};
