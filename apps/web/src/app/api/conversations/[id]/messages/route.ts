import { NextResponse } from 'next/server';
import type { ChatMessageView } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const message = await apiRequestAuthed<ChatMessageView>(`/conversations/${id}/messages`, {
      method: 'POST',
      body,
    });
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to send message' }, { status: 500 });
  }
}
