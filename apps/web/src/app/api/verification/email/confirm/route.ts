import { NextResponse } from 'next/server';
import type { ProducerVerificationStatus } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await apiRequestAuthed<ProducerVerificationStatus>(
      '/verification/email/confirm',
      { method: 'POST', body },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to confirm email code' }, { status: 500 });
  }
}
