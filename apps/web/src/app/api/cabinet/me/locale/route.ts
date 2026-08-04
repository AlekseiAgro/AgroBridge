import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = await apiRequestAuthed<{ locale: string }>('/cabinet/me/locale', {
      method: 'PATCH',
      body,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to update locale' }, { status: 500 });
  }
}
