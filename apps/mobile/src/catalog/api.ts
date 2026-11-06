import type { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import { parseMineQuotes, type MineQuote } from '../requests/quotes';
import {
  parseCatalogCategories,
  parseCatalogProduct,
  parseCatalogProducts,
  parseCatalogRequest,
  parseCatalogRequests,
  parseFarmProfile,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogFarmProfile,
  type CatalogRequest,
} from './model';
import { productsPath, purchaseRequestsPath } from './query';

export type CatalogListQuery = {
  categoryId?: string | null;
  query?: string | null;
  locale?: string | null;
  region?: string | readonly string[] | null;
  harvestStatus?: string | null;
  preorder?: boolean;
  inSeason?: boolean;
  newest?: number | null;
};

export function listCategories(api: ApiClient): Promise<CatalogCategory[]> {
  return api
    .request<unknown>('/categories', { auth: false })
    .then((body) => parseCatalogCategories(body));
}

export function listProducts(api: ApiClient, query: CatalogListQuery = {}): Promise<CatalogProduct[]> {
  const load = (input: CatalogListQuery) =>
    api.request<unknown>(productsPath(input), { auth: false }).then((body) => parseCatalogProducts(body));
  return load(query).catch((error: unknown) => {
    if (query.newest && error instanceof ApiError && error.status === 400) {
      return load({ ...query, newest: null });
    }
    throw error;
  });
}

export function listPurchaseRequests(
  api: ApiClient,
  query: CatalogListQuery = {},
): Promise<CatalogRequest[]> {
  return api
    .request<unknown>(purchaseRequestsPath(query), { auth: false })
    .then((body) => parseCatalogRequests(body));
}

export function productDetailPath(productId: string, locale?: string | null): string {
  return productsPath({ locale }).replace('/products', `/products/${encodeURIComponent(productId)}`);
}

/**
 * The website product page sends the session token.
 * A signed-in owner can open a listing that the public catalog hides.
 */
export function productDetailAuth(ownerPreview: boolean, signedIn: boolean): boolean {
  return ownerPreview || signedIn;
}

export function getProduct(
  api: ApiClient,
  productId: string,
  locale?: string | null,
  auth = false,
): Promise<CatalogProduct | null> {
  return api
    .request<unknown>(productDetailPath(productId, locale), { auth })
    .then((body) => parseCatalogProduct(body));
}

export function getFarm(
  api: ApiClient,
  farmId: string,
  locale?: string | null,
): Promise<CatalogFarmProfile | null> {
  const params = new URLSearchParams();
  if (locale) {
    params.set('locale', locale);
  }
  const query = params.toString();
  const path = `/farms/${encodeURIComponent(farmId)}${query ? `?${query}` : ''}`;
  return api.request<unknown>(path, { auth: false }).then((body) => parseFarmProfile(body));
}

export function getPurchaseRequest(
  api: ApiClient,
  requestId: string,
  locale?: string | null,
  auth = false,
): Promise<CatalogRequest | null> {
  const path = purchaseRequestsPath({ locale }).replace(
    '/purchase-requests',
    `/purchase-requests/${encodeURIComponent(requestId)}`,
  );
  return api.request<unknown>(path, { auth }).then((body) => parseCatalogRequest(body));
}

export function listMyPurchaseRequests(api: ApiClient): Promise<CatalogRequest[]> {
  return api.request<unknown>('/purchase-requests/mine').then((body) => parseCatalogRequests(body));
}

export function listMyQuotes(api: ApiClient): Promise<MineQuote[]> {
  return api.request<unknown>('/purchase-requests/my-quotes').then((body) => parseMineQuotes(body));
}

export function createPurchaseRequest(
  api: ApiClient,
  body: Record<string, string>,
): Promise<CatalogRequest | null> {
  return api
    .request<unknown>('/purchase-requests', { method: 'POST', body })
    .then((response) => parseCatalogRequest(response));
}

export function postPurchaseRequestAction(
  api: ApiClient,
  requestId: string,
  action: 'cancel' | 'close' | 'accept' | 'decline' | 'withdraw',
  quoteId?: string,
): Promise<CatalogRequest | null> {
  const path =
    action === 'cancel' || action === 'close'
      ? `/purchase-requests/${encodeURIComponent(requestId)}/${action}`
      : `/purchase-requests/${encodeURIComponent(requestId)}/quotes/${encodeURIComponent(quoteId ?? '')}/${action}`;
  return api.request<unknown>(path, { method: 'POST' }).then((body) => parseCatalogRequest(body));
}

export function createPurchaseQuote(
  api: ApiClient,
  requestId: string,
  body: Record<string, string>,
): Promise<CatalogRequest | null> {
  return api
    .request<unknown>(`/purchase-requests/${encodeURIComponent(requestId)}/quotes`, {
      method: 'POST',
      body,
    })
    .then((response) => parseCatalogRequest(response));
}
