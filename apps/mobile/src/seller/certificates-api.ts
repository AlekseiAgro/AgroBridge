import type { ApiClient } from '../api/client';
import { parseSellerProductDetail, type SellerProductDetail } from './edit';
import {
  certificateDeletePath,
  certificateUploadPath,
  fillCertificateForm,
  type CertificateFile,
  type CertificateType,
} from './certificates';

const CERTIFICATE_TIMEOUT_MS = 60_000;

export function uploadProductCertificate(
  api: ApiClient,
  productId: string,
  type: CertificateType,
  title: string,
  file: CertificateFile,
): Promise<SellerProductDetail> {
  const form = new FormData();
  fillCertificateForm(form, { type, title, file });
  return readCertificateProduct(
    api.request<unknown>(certificateUploadPath(productId), {
      method: 'POST',
      formData: form,
      timeoutMs: CERTIFICATE_TIMEOUT_MS,
    }),
  );
}

export function deleteProductCertificate(
  api: ApiClient,
  productId: string,
  certificateId: string,
): Promise<SellerProductDetail> {
  return readCertificateProduct(
    api.request<unknown>(certificateDeletePath(productId, certificateId), {
      method: 'DELETE',
      timeoutMs: CERTIFICATE_TIMEOUT_MS,
    }),
  );
}

async function readCertificateProduct(request: Promise<unknown>): Promise<SellerProductDetail> {
  const product = parseSellerProductDetail(await request);
  if (!product) {
    throw new Error('Product certificate response was invalid.');
  }
  return product;
}
