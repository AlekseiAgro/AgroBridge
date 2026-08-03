import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await apiRequestAuthed<{ sent: true; destination: string }>(
      '/verification/phone/send-code',
      { method: 'POST', body },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to send SMS code' }, { status: 500 });
  }
}
