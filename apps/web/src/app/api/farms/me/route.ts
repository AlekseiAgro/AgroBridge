import { NextResponse } from 'next/server';
import type { FarmDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const farm = await apiRequestAuthed<FarmDetail>('/farms/me', {
      method: 'PATCH',
      body,
    });
    return NextResponse.json(farm);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to update farm' }, { status: 500 });
  }
}
