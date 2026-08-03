import { PRODUCT_DESCRIPTION_I18N } from './product-descriptions';
import { PRODUCT_TITLE_I18N } from './product-titles';

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replaceAll('ё', 'е').trim();
}

function textMatchesQuery(text: string, needle: string): boolean {
  return normalizeSearchText(text).includes(needle);
}

/**
 * Maps a free-text catalog query to canonical English title/description keys
 * stored in the database, so localized UI search still finds demo listings.
 */
export function catalogSearchCanonicalMatches(query: string): {
  titles: string[];
  descriptions: string[];
} {
  const needle = normalizeSearchText(query);
  if (!needle) {
    return { titles: [], descriptions: [] };
  }

  const titles: string[] = [];
  for (const [canonical, translations] of Object.entries(PRODUCT_TITLE_I18N)) {
    if (textMatchesQuery(canonical, needle)) {
      titles.push(canonical);
      continue;
    }
    if (Object.values(translations).some((text) => text && textMatchesQuery(text, needle))) {
      titles.push(canonical);
    }
  }

  const descriptions: string[] = [];
  for (const [canonical, translations] of Object.entries(PRODUCT_DESCRIPTION_I18N)) {
    if (textMatchesQuery(canonical, needle)) {
      descriptions.push(canonical);
      continue;
    }
    if (Object.values(translations).some((text) => text && textMatchesQuery(text, needle))) {
      descriptions.push(canonical);
    }
  }

  return { titles, descriptions };
}
