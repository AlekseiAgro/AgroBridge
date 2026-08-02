import { NextResponse } from 'next/server';
import type { ProductDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const response = await fetch(`${API_URL}/products/${id}/images`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      cache: 'no-store',
    });

    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data &&
        'message' in data &&
        typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : 'Failed to upload image';
      return NextResponse.json({ message }, { status: response.status });
    }

    return NextResponse.json(data as ProductDetail);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to upload image' }, { status: 500 });
  }
}
