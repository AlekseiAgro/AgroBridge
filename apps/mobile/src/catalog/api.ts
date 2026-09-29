import type { ApiClient } from '../api/client';
import {
  parseCatalogCategories,
  parseCatalogProduct,
  parseCatalogProducts,
  parseCatalogRequest,
  parseCatalogRequests,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogRequest,
} from './model';
import { productsPath, purchaseRequestsPath } from './query';

export type CatalogListQuery = {
  categoryId?: string | null;
  query?: string | null;
  locale?: string | null;
};

export function listCategories(api: ApiClient): Promise<CatalogCategory[]> {
  return api
    .request<unknown>('/categories', { auth: false })
    .then((body) => parseCatalogCategories(body));
}

export function listProducts(api: ApiClient, query: CatalogListQuery = {}): Promise<CatalogProduct[]> {
  return api
    .request<unknown>(productsPath(query), { auth: false })
    .then((body) => parseCatalogProducts(body));
}

export function listPurchaseRequests(
  api: ApiClient,
  query: CatalogListQuery = {},
): Promise<CatalogRequest[]> {
  return api
    .request<unknown>(purchaseRequestsPath(query), { auth: false })
    .then((body) => parseCatalogRequests(body));
}

export function getProduct(
  api: ApiClient,
  productId: string,
  locale?: string | null,
): Promise<CatalogProduct | null> {
  const path = productsPath({ locale }).replace('/products', `/products/${encodeURIComponent(productId)}`);
  return api.request<unknown>(path, { auth: false }).then((body) => parseCatalogProduct(body));
}

export function getPurchaseRequest(
  api: ApiClient,
  requestId: string,
  locale?: string | null,
): Promise<CatalogRequest | null> {
  const path = purchaseRequestsPath({ locale }).replace(
    '/purchase-requests',
    `/purchase-requests/${encodeURIComponent(requestId)}`,
  );
  return api.request<unknown>(path, { auth: false }).then((body) => parseCatalogRequest(body));
}
