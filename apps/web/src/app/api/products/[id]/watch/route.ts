import { NextResponse } from 'next/server';
import type { HarvestWatchStatus } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await apiRequestAuthed<HarvestWatchStatus>(`/products/${id}/watch`);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to load watch status' }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await apiRequestAuthed<HarvestWatchStatus>(`/products/${id}/watch`, {
      method: 'POST',
      body: {},
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to watch product' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await apiRequestAuthed<HarvestWatchStatus>(`/products/${id}/watch`, {
      method: 'DELETE',
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to unwatch product' }, { status: 500 });
  }
}
