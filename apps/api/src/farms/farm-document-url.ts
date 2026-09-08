/**
 * Farm verification documents are private. They are never exposed through the public
 * /api/uploads routes; this path is served by FarmDocumentsController, which allows
 * only the farm owner or an admin.
 */
export function farmDocumentFileUrl(documentId: string): string {
  return `/api/farms/documents/${documentId}/file`;
}
