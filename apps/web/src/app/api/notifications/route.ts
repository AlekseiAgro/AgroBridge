import { NextResponse } from 'next/server';
import type { UserNotificationItem } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const path = limit ? `/notifications?limit=${encodeURIComponent(limit)}` : '/notifications';
    const data = await apiRequestAuthed<UserNotificationItem[]>(path);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load notifications' }, { status: 500 });
  }
}
