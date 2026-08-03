import { NextResponse } from 'next/server';
import type { AuthTokenResponse } from '@agrobridge/shared';
import { ApiError, apiRequest } from '@/lib/api';
import { setAuthCookie } from '@/lib/auth-cookie';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await apiRequest<AuthTokenResponse>('/auth/login', {
      method: 'POST',
      body,
    });

    await setAuthCookie(result.accessToken);
    return NextResponse.json({ user: result.user });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json({ message: 'Login failed' }, { status: 500 });
  }
}
