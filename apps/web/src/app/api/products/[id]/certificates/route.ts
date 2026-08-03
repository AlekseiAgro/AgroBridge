import type { ProductDetail } from '@agrobridge/shared';
import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/auth-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getAuthToken();
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const response = await fetch(`${API_URL}/products/${id}/certificates`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: await request.formData(),
      cache: 'no-store',
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const message =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message: unknown }).message)
          : 'Failed to upload certificate';
      return NextResponse.json({ message }, { status: response.status });
    }
    return NextResponse.json(data as ProductDetail);
  } catch {
    return NextResponse.json({ message: 'Failed to upload certificate' }, { status: 500 });
  }
}
