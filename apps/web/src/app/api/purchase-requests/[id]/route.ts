import { NextResponse } from 'next/server';
import type { PurchaseRequestDetail } from '@agrobridge/shared';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getAuthToken();
    const item = await apiRequest<PurchaseRequestDetail>(`/purchase-requests/${id}`, { token });
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load purchase request' }, { status: 500 });
  }
}
