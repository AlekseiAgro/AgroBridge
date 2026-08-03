import { localizeProductTitle } from '@agrobridge/shared';

/** Localized product title for the active UI locale. */
export function formatProductTitle(
  title: string | null | undefined,
  locale: string,
): string {
  return localizeProductTitle(title, locale);
}
