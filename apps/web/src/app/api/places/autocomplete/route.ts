import { NextResponse } from 'next/server';
import type { PlacesAutocompleteResponse } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    const language = searchParams.get('language') ?? '';
    const country = searchParams.get('country') ?? '';

    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (language) params.set('language', language);
    if (country) params.set('country', country);

    const data = await apiRequestAuthed<PlacesAutocompleteResponse>(
      `/places/autocomplete?${params.toString()}`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Failed to autocomplete place' }, { status: 500 });
  }
}
