import { NextResponse } from 'next/server';
import type { ConversationDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const locale = new URL(request.url).searchParams.get('locale');
    const path =
      locale && locale.trim()
        ? `/conversations/${id}?locale=${encodeURIComponent(locale.trim())}`
        : `/conversations/${id}`;
    const conversation = await apiRequestAuthed<ConversationDetail>(path);
    return NextResponse.json(conversation);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load conversation' }, { status: 500 });
  }
}
