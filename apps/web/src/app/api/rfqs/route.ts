import { NextResponse } from 'next/server';
import type { RfqSummary } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rfq = await apiRequestAuthed<RfqSummary>('/rfqs', {
      method: 'POST',
      body,
    });
    return NextResponse.json(rfq);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to create request' }, { status: 500 });
  }
}
