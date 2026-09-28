import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@agrobridge/shared';

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  /**
   * HTML alternate links and the sitemap already publish hreflang, with
   * x-default on the explicit English URL. next-intl's HTTP Link header
   * keeps a locale-less x-default even when the prefix mode is `always`.
   * This flag skips only that header.
   */
  alternateLinks: false,
});
