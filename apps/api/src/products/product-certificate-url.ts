/**
 * Product certificates are private objects. The browser never receives a storage key
 * or public R2 URL; files are streamed by ProductsService after authorization.
 */
export function productCertificateFileUrl(productId: string, certificateId: string): string {
  return `/api/products/${productId}/certificates/${certificateId}/file`;
}

/** CUID-like ids plus the short fixtures used in tests. Rejects path separators. */
export const PRODUCT_CERTIFICATE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isProductCertificateId(value: string): boolean {
  return PRODUCT_CERTIFICATE_ID_RE.test(value);
}
