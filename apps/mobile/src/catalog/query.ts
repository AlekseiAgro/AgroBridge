import type { CatalogProduct, CatalogRequest } from './model';

/**
 * Query string sent to the API.
 * Collapses whitespace and applies Unicode NFC. ё is kept so the backend
 * dictionary search can fold it the same way as catalogSearchCanonicalMatches.
 */
export function normalizeQueryParam(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Comparison key for catalog text.
 * Case-insensitive, whitespace-normalized, NFC, and е/ё equivalent.
 */
export function normalizeSearchText(value: string): string {
  return normalizeQueryParam(value).toLowerCase().replace(/ё/g, 'е');
}

export function textMatches(query: string, parts: (string | null | undefined)[]): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) {
    return true;
  }
  const haystack = normalizeSearchText(parts.filter((part) => part && part.trim()).join('\n'));
  return haystack.includes(needle);
}

export function withSearchParams(
  path: string,
  params: Record<string, string | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeQueryParam(value);
    if (normalized) {
      search.set(key, normalized);
    }
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function productsPath(input: {
  categoryId?: string | null;
  query?: string | null;
  locale?: string | null;
}): string {
  return withSearchParams('/products', {
    category: input.categoryId,
    q: input.query,
    locale: input.locale,
  });
}

export function purchaseRequestsPath(input: {
  categoryId?: string | null;
  query?: string | null;
  locale?: string | null;
}): string {
  return withSearchParams('/purchase-requests', {
    category: input.categoryId,
    q: input.query,
    locale: input.locale,
  });
}

export function filterCatalogProducts(
  products: CatalogProduct[],
  query: string,
  extraParts: (product: CatalogProduct) => string[] = () => [],
): CatalogProduct[] {
  const needle = normalizeSearchText(query);
  if (!needle) {
    return products;
  }
  return products.filter((product) =>
    textMatches(query, [
      product.title,
      product.description,
      product.variety,
      product.originPlace,
      product.country,
      product.farm?.name,
      product.farm?.region,
      product.owner.displayName,
      product.category,
      ...extraParts(product),
    ]),
  );
}

export function filterCatalogRequests(
  requests: CatalogRequest[],
  query: string,
  extraParts: (request: CatalogRequest) => string[] = () => [],
): CatalogRequest[] {
  const needle = normalizeSearchText(query);
  if (!needle) {
    return requests;
  }
  return requests.filter((request) =>
    textMatches(query, [
      request.title,
      request.quantity,
      request.unit,
      request.variety,
      request.packaging,
      request.destinationCountry,
      request.message,
      request.category,
      request.buyer.displayName,
      ...extraParts(request),
    ]),
  );
}

export function unionById<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const seen = new Set(primary.map((item) => item.id));
  const merged = [...primary];
  for (const item of extra) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
