import { NextResponse } from 'next/server';
import { ApiError, apiRequest } from '@/lib/api';
import { visitorAddressOf } from '@/lib/client-address';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await apiRequest<{ ok: true }>('/auth/forgot-password', {
      method: 'POST',
      body,
      forwardedFor: visitorAddressOf(request),
    });
    return NextResponse.json({ ok: result.ok });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Request failed' }, { status: 500 });
  }
}
