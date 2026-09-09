/**
 * Same-origin rewrite for marketplace media stored under `/api/uploads/...`.
 * Farm verification documents must never be treated as public media, including
 * leftover rows whose `url` still points at the old uploads path.
 */
const FARM_DOCUMENT_UPLOAD_RE = /\/api\/uploads\/farms\/[^/]+\/documents\//;

export function isLegacyFarmDocumentUploadUrl(url: string): boolean {
  return FARM_DOCUMENT_UPLOAD_RE.test(url);
}

export function toPublicMediaUrl(url: string): string {
  if (isLegacyFarmDocumentUploadUrl(url)) {
    return '';
  }
  const match = url.match(/\/api\/uploads\/.+$/);
  if (match) {
    return match[0];
  }
  return url;
}
