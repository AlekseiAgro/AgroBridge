import { localizeProductDescription, localizeProductTitle } from '@agrobridge/shared';

/** Localized product title for the active UI locale. */
export function formatProductTitle(
  title: string | null | undefined,
  locale: string,
): string {
  return localizeProductTitle(title, locale);
}

/** Localized product description for the active UI locale. */
export function formatProductDescription(
  description: string | null | undefined,
  locale: string,
): string {
  return localizeProductDescription(description, locale);
}
