import { NextResponse } from 'next/server';
import type { PurchaseRequestDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const item = await apiRequestAuthed<PurchaseRequestDetail>(`/purchase-requests/${id}/close`, {
      method: 'POST',
    });
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to close purchase request' }, { status: 500 });
  }
}
