import { NextResponse } from 'next/server';
import type { ConversationDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const conversation = await apiRequestAuthed<ConversationDetail>('/conversations', {
      method: 'POST',
      body,
    });
    return NextResponse.json(conversation);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to open conversation' }, { status: 500 });
  }
}
