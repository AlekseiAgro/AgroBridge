/**
 * Same-origin rewrite for marketplace media stored under `/api/uploads/...`.
 * Absolute CDN/R2 URLs (`STORAGE_PUBLIC_BASE_URL/{key}`) are left unchanged so
 * they do not pass through the Web `/api/uploads` rewrite.
 * Farm verification documents and product certificates must never be treated as
 * public media, including leftover rows whose `url` still points at the old uploads
 * path or a CDN key.
 */
const FARM_DOCUMENT_UPLOAD_RE = /\/api\/uploads\/farms\/[^/]+\/documents\//;
const FARM_DOCUMENT_OBJECT_RE = /(?:^|\/)farms\/[^/]+\/documents\//;
const PRODUCT_CERTIFICATE_UPLOAD_RE = /\/api\/uploads\/products\/[^/]+\/certificates\//;
const PRODUCT_CERTIFICATE_OBJECT_RE = /(?:^|\/)products\/[^/]+\/certificates\//;

export function isLegacyFarmDocumentUploadUrl(url: string): boolean {
  return FARM_DOCUMENT_UPLOAD_RE.test(url);
}

export function isFarmVerificationObjectUrl(url: string): boolean {
  return FARM_DOCUMENT_OBJECT_RE.test(url);
}

export function isProductCertificateObjectUrl(url: string): boolean {
  if (/\/api\/products\/[^/]+\/certificates\//.test(url)) {
    return false;
  }
  return PRODUCT_CERTIFICATE_OBJECT_RE.test(url) || PRODUCT_CERTIFICATE_UPLOAD_RE.test(url);
}

export function toPublicMediaUrl(url: string): string {
  if (!url) {
    return url;
  }
  if (
    isFarmVerificationObjectUrl(url) ||
    isLegacyFarmDocumentUploadUrl(url) ||
    isProductCertificateObjectUrl(url)
  ) {
    return '';
  }
  const match = url.match(/\/api\/uploads\/.+$/);
  if (match) {
    return match[0];
  }
  return url;
}
