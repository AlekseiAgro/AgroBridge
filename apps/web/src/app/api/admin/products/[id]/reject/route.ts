import { NextResponse } from 'next/server';
import type { ModeratedProduct } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const product = await apiRequestAuthed<ModeratedProduct>(`/admin/products/${id}/reject`, {
      method: 'POST',
      body,
    });
    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to reject product' }, { status: 500 });
  }
}
