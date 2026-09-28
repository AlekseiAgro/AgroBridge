import { NextResponse } from 'next/server';
import { ApiError, apiRequest } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-cookie';
import { visitorAddressOf } from '@/lib/client-address';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const token = await getAuthToken();
    const data = await apiRequest<{ recorded: boolean }>(`/products/${id}/views`, {
      method: 'POST',
      body: {},
      token,
      forwardedFor: visitorAddressOf(request),
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to record product view' }, { status: 500 });
  }
}
