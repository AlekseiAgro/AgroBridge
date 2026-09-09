/**
 * Farm verification documents are private. They are never exposed through the public
 * /api/uploads routes; this path is served by FarmDocumentsController, which allows
 * only the farm owner or an admin.
 */
export function farmDocumentFileUrl(documentId: string): string {
  return `/api/farms/documents/${documentId}/file`;
}

/** CUID-like ids plus the short fixtures used in tests. Rejects path separators. */
export const FARM_DOCUMENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isFarmDocumentId(value: string): boolean {
  return FARM_DOCUMENT_ID_RE.test(value);
}
