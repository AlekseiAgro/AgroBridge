import { getAuthToken } from '@/lib/auth-cookie';
import { serverApiUrl } from '@/lib/api-base-url';
import { proxyProductCertificateFile } from '@/lib/product-certificate-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string; certificateId: string }> };

/**
 * Product certificates are private objects. Approved files on a public listing may
 * be fetched without a cookie; pending/rejected files require the httpOnly session.
 * The upstream host comes only from `serverApiUrl()` (`API_INTERNAL_URL`).
 */
export async function GET(_request: Request, { params }: Params) {
  const { id, certificateId } = await params;
  const token = await getAuthToken();
  return proxyProductCertificateFile({
    productId: id,
    certificateId,
    token,
    apiBaseUrl: serverApiUrl(),
  });
}
