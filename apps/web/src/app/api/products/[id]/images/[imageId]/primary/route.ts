import { NextResponse } from 'next/server';
import type { ProductDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string; imageId: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { id, imageId } = await params;
    const product = await apiRequestAuthed<ProductDetail>(
      `/products/${id}/images/${imageId}/primary`,
      { method: 'PATCH' },
    );
    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to set primary image' }, { status: 500 });
  }
}
