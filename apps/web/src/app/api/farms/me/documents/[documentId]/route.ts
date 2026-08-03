import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ documentId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { documentId } = await params;
    await apiRequestAuthed(`/farms/me/documents/${documentId}`, {
      method: 'DELETE',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to delete document' }, { status: 500 });
  }
}
