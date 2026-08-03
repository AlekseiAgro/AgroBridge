import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await apiRequestAuthed<{ sent: true; destination: string }>(
      '/cabinet/me/delete/request',
      { method: 'POST', body },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: 'Failed to send account deletion confirmation' },
      { status: 500 },
    );
  }
}
