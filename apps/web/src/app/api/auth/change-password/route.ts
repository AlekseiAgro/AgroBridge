import { NextResponse } from 'next/server';
import type { AuthTokenResponse } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { setAuthCookie } from '@/lib/auth-cookie';
import { visitorAddressOf } from '@/lib/client-address';
import { apiRequestAuthed } from '@/lib/server-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await apiRequestAuthed<AuthTokenResponse>('/auth/change-password', {
      method: 'POST',
      body,
      forwardedFor: visitorAddressOf(request),
    });

    await setAuthCookie(result.accessToken);
    return NextResponse.json({ user: result.user, ok: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Request failed' }, { status: 500 });
  }
}
