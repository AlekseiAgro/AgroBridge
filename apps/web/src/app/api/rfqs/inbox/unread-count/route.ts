import { NextResponse } from 'next/server';
import type { PendingInboxCount } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function GET() {
  try {
    const data = await apiRequestAuthed<PendingInboxCount>('/rfqs/inbox/unread-count');
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load inbox unread count' }, { status: 500 });
  }
}
