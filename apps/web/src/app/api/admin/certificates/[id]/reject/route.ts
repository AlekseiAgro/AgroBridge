import { NextResponse } from 'next/server';
import type { ProductCertificate } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { isProductCertificateId } from '@/lib/product-certificate-bff';
import { apiRequestAuthed } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!isProductCertificateId(id)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const result = await apiRequestAuthed<ProductCertificate>(`/admin/certificates/${id}/reject`, {
      method: 'POST',
      body,
    });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to reject certificate' }, { status: 500 });
  }
}
