import { NextResponse } from 'next/server';
import type { PurchaseRequestDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

const ACTIONS = new Set(['accept', 'decline', 'withdraw']);

type Params = { params: Promise<{ id: string; quoteId: string; action: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id, quoteId, action } = await params;
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
    }

    const item = await apiRequestAuthed<PurchaseRequestDetail>(
      `/purchase-requests/${id}/quotes/${quoteId}/${action}`,
      { method: 'POST' },
    );
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to update quote' }, { status: 500 });
  }
}
