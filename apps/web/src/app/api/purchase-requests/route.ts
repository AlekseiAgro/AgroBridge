import { NextResponse } from 'next/server';
import type { PurchaseRequestDetail, PurchaseRequestSummary } from '@agrobridge/shared';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';
import { apiRequestAuthed } from '@/lib/server-api';

export async function GET(request: Request) {
  try {
    const token = await getAuthToken();
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const path = query ? `/purchase-requests?${query}` : '/purchase-requests';
    const items = await apiRequest<PurchaseRequestSummary[]>(path, { token });
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load purchase requests' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await apiRequestAuthed<PurchaseRequestDetail>('/purchase-requests', {
      method: 'POST',
      body,
    });
    return NextResponse.json(created);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to create purchase request' }, { status: 500 });
  }
}
