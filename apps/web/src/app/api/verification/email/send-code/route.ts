import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { forwardedForOf } from '@/lib/client-address';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const data = await apiRequestAuthed<{ sent: true; destination: string }>(
      '/verification/email/send-code',
      { method: 'POST', body: {}, forwardedFor: forwardedForOf(request) },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to send email code' }, { status: 500 });
  }
}
