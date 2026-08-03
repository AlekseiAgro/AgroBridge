import { NextResponse } from 'next/server';
import type { AlertSubscription } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function GET() {
  try {
    const data = await apiRequestAuthed<AlertSubscription>('/subscriptions/alerts');
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load subscription' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await apiRequestAuthed<AlertSubscription>('/subscriptions/alerts', {
      method: 'PUT',
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to save subscription' }, { status: 500 });
  }
}
