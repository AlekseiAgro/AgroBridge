import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await apiRequestAuthed(`/admin/users/${id}/unblock`, {
      method: 'POST',
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to unblock user' }, { status: 500 });
  }
}
