import type { ApiClient } from '../api/client';
import { parseSellerProductDetail, type SellerProductDetail } from './edit';
import { fillProductVideoForm, productVideoDeletePath, productVideoUploadPath, type ProductVideoFile } from './video';

const VIDEO_TIMEOUT_MS = 180_000;

export function uploadProductVideo(
  api: ApiClient,
  productId: string,
  file: ProductVideoFile,
): Promise<SellerProductDetail> {
  const form = new FormData();
  fillProductVideoForm(form, file);
  return readVideoProduct(
    api.request<unknown>(productVideoUploadPath(productId), {
      method: 'POST',
      formData: form,
      timeoutMs: VIDEO_TIMEOUT_MS,
    }),
  );
}

export function deleteProductVideo(
  api: ApiClient,
  productId: string,
  videoId: string,
): Promise<SellerProductDetail> {
  return readVideoProduct(
    api.request<unknown>(productVideoDeletePath(productId, videoId), {
      method: 'DELETE',
      timeoutMs: VIDEO_TIMEOUT_MS,
    }),
  );
}

async function readVideoProduct(request: Promise<unknown>): Promise<SellerProductDetail> {
  const product = parseSellerProductDetail(await request);
  if (!product) {
    throw new Error('Product video response was invalid.');
  }
  return product;
}
