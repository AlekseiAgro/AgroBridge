import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await apiRequestAuthed(`/notifications/${id}/read`, {
      method: 'POST',
      body: {},
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to mark notification as read' }, { status: 500 });
  }
}
