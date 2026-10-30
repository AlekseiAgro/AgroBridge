import type { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import { createdDraftFromResponse, type CreateProductDraftBody } from './draft';
import { parseSellerProductDetail, type SellerProductDetail, type UpdateProductBody } from './edit';
import {
  parseSellerProduct,
  parseSellerProducts,
  type SellerHarvestStatus,
  type SellerProduct,
} from './products';

/** Owner listings, newest update first. Requires JWT and a verified email. */
export function listMyProducts(api: ApiClient): Promise<SellerProduct[]> {
  return api.request<unknown>('/products/mine').then((body) => parseSellerProducts(body));
}

/** Saves an unpublished product. The server attaches the seller's farm when one exists. */
export function createProductDraft(api: ApiClient, body: CreateProductDraftBody): Promise<SellerProduct> {
  return api.request<unknown>('/products', { method: 'POST', body }).then((response) => {
    const product = createdDraftFromResponse(response);
    if (!product) {
      throw new Error('Product draft response was invalid.');
    }
    return product;
  });
}

/** Owner product, including drafts. Requires JWT. Another seller's product is treated as missing. */
export function getSellerProduct(api: ApiClient, productId: string): Promise<SellerProductDetail> {
  return api.request<unknown>(`/products/${productId}`).then((body) => {
    const product = parseSellerProductDetail(body);
    if (!product) {
      throw new ApiError({ message: 'Product not found', status: 404, kind: 'http' });
    }
    return product;
  });
}

/** Changes only harvest status. Unset is null. No other product fields are sent. */
export function updateSellerHarvestStatus(
  api: ApiClient,
  productId: string,
  body: { harvestStatus: SellerHarvestStatus | null },
): Promise<SellerProduct> {
  return api.request<unknown>(`/products/${productId}`, { method: 'PATCH', body }).then((response) => {
    const product = parseSellerProduct(response);
    if (!product) {
      throw new Error('Harvest status response was invalid.');
    }
    return product;
  });
}

/** Deletes an owned product. The API removes the row and its media. No request body. */
export function deleteSellerProduct(api: ApiClient, productId: string): Promise<void> {
  return api.request(`/products/${productId}`, { method: 'DELETE' }).then(() => undefined);
}

/** Saves the seller form. Publication stays as the Web save rule encoded in the body. */
export function updateSellerProduct(
  api: ApiClient,
  productId: string,
  body: UpdateProductBody,
): Promise<SellerProductDetail> {
  return api.request<unknown>(`/products/${productId}`, { method: 'PATCH', body }).then((response) => {
    const product = parseSellerProductDetail(response);
    if (!product) {
      throw new Error('Product update response was invalid.');
    }
    return product;
  });
}
