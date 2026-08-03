import { NextResponse } from 'next/server';
import type { FarmDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const farm = await apiRequestAuthed<FarmDetail>('/farms', {
      method: 'POST',
      body,
    });
    return NextResponse.json(farm);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to create farm' }, { status: 500 });
  }
}
