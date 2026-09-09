import type { ProductDetail } from '@agrobridge/shared';
import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth-cookie';
import { serverApiUrl } from '@/lib/api-base-url';
import { isProductCertificateId } from '@/lib/product-certificate-bff';

export const dynamic = 'force-dynamic';

const API_URL = serverApiUrl();

type Params = { params: Promise<{ id: string; certificateId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, certificateId } = await params;
    if (!isProductCertificateId(id) || !isProductCertificateId(certificateId)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const token = await getAuthToken();
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const response = await fetch(`${API_URL}/products/${id}/certificates/${certificateId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : 'Failed to delete certificate';
      return NextResponse.json({ message }, { status: response.status });
    }
    return NextResponse.json(data as ProductDetail, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ message: 'Failed to delete certificate' }, { status: 500 });
  }
}
