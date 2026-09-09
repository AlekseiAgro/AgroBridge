/**
 * Owner-facing certificate links must always be the authorized app path.
 * Never use a stored CDN, /api/uploads, or raw storage key in the browser.
 */
export function ownerCertificateFileHref(productId: string, certificateId: string): string {
  return `/api/products/${productId}/certificates/${certificateId}/file`;
}

const AUTHORIZED_CERT_HREF_RE =
  /^\/api\/products\/[A-Za-z0-9_-]{1,64}\/certificates\/[A-Za-z0-9_-]{1,64}\/file$/;

export function isAuthorizedCertificateHref(href: string): boolean {
  return AUTHORIZED_CERT_HREF_RE.test(href);
}
