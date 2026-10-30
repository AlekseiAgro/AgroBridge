import type { ApiClient } from '../api/client';
import { parseSellerProductDetail, type SellerProductDetail } from './edit';
import {
  fillProductImageForm,
  productImageDeletePath,
  productImagePrimaryPath,
  productImageUploadPath,
  type ProductPhotoFile,
} from './photos';

const PHOTO_TIMEOUT_MS = 60_000;

/** Uploads one product photo. The multipart field is `file`; kind is `overview`. */
export function uploadProductImage(
  api: ApiClient,
  productId: string,
  file: ProductPhotoFile,
): Promise<SellerProductDetail> {
  const form = new FormData();
  fillProductImageForm(form, file);
  return readPhotoProduct(
    api.request<unknown>(productImageUploadPath(productId), {
      method: 'POST',
      formData: form,
      timeoutMs: PHOTO_TIMEOUT_MS,
    }),
  );
}

export function deleteProductImage(
  api: ApiClient,
  productId: string,
  imageId: string,
): Promise<SellerProductDetail> {
  return readPhotoProduct(
    api.request<unknown>(productImageDeletePath(productId, imageId), {
      method: 'DELETE',
      timeoutMs: PHOTO_TIMEOUT_MS,
    }),
  );
}

export function setProductImagePrimary(
  api: ApiClient,
  productId: string,
  imageId: string,
): Promise<SellerProductDetail> {
  return readPhotoProduct(
    api.request<unknown>(productImagePrimaryPath(productId, imageId), {
      method: 'PATCH',
      timeoutMs: PHOTO_TIMEOUT_MS,
    }),
  );
}

async function readPhotoProduct(request: Promise<unknown>): Promise<SellerProductDetail> {
  const product = parseSellerProductDetail(await request);
  if (!product) {
    throw new Error('Product image response was invalid.');
  }
  return product;
}
