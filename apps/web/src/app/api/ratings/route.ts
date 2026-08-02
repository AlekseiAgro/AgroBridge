import { NextResponse } from 'next/server';
import type { RatingView } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rating = await apiRequestAuthed<RatingView>('/ratings', {
      method: 'POST',
      body,
    });
    return NextResponse.json(rating, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to submit rating' }, { status: 500 });
  }
}
