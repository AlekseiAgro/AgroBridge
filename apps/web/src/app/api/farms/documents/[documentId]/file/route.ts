import { getAuthToken } from '@/lib/auth-cookie';
import { serverApiUrl } from '@/lib/api-base-url';
import { proxyFarmDocumentFile } from '@/lib/farm-document-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ documentId: string }> };

/**
 * Farm verification documents are private, so the browser cannot fetch them from the API
 * directly: the auth token lives in an httpOnly cookie. This proxies the download with a
 * Bearer token; the API still decides whether the caller owns the farm or is an admin.
 *
 * The upstream host comes only from `serverApiUrl()` (`API_INTERNAL_URL`). The path is a
 * fixed template around a validated document id — never a client-supplied URL.
 */
export async function GET(_request: Request, { params }: Params) {
  const { documentId } = await params;
  const token = await getAuthToken();
  return proxyFarmDocumentFile({
    documentId,
    token,
    apiBaseUrl: serverApiUrl(),
  });
}
