import { NextResponse } from 'next/server';
import type { SupportRequestResponse } from '@agrobridge/shared';
import { ApiError, apiRequest } from '@/lib/api';
import { visitorAddressOf } from '@/lib/client-address';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await apiRequest<SupportRequestResponse>('/support', {
      method: 'POST',
      body,
      forwardedFor: visitorAddressOf(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Support request failed' }, { status: 500 });
  }
}
