import { NextResponse } from 'next/server';
import type { ProductDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const product = await apiRequestAuthed<ProductDetail>('/products', {
      method: 'POST',
      body,
    });
    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to create product' }, { status: 500 });
  }
}
