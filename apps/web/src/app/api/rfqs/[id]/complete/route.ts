import { NextResponse } from 'next/server';
import type { RfqSummary } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const rfq = await apiRequestAuthed<RfqSummary>(`/rfqs/${id}/complete`, { method: 'POST' });
    return NextResponse.json(rfq);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to complete deal' }, { status: 500 });
  }
}
