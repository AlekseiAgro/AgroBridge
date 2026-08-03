import { NextResponse } from 'next/server';
import type { ProductMarketInsight } from '@agrobridge/shared';
import { ApiError, apiRequest } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'en';
    const data = await apiRequest<ProductMarketInsight>(
      `/products/${id}/market-insight?locale=${encodeURIComponent(locale)}`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load market insight' }, { status: 500 });
  }
}
