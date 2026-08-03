import { NextResponse } from 'next/server';
import type { FarmDetail } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ photoId: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { photoId } = await params;
    const farm = await apiRequestAuthed<FarmDetail>(`/farms/me/photos/${photoId}/primary`, {
      method: 'PATCH',
    });
    return NextResponse.json(farm);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to update primary photo' }, { status: 500 });
  }
}
