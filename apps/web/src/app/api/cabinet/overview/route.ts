import { NextResponse } from 'next/server';
import type { CabinetOverview } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function GET() {
  try {
    const overview = await apiRequestAuthed<CabinetOverview>('/cabinet/overview');
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load cabinet' }, { status: 500 });
  }
}
