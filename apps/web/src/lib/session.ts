import type { PublicUser } from '@agrobridge/shared';
import { apiRequest } from './api';
import { getAuthToken } from './auth-cookie';

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await getAuthToken();
  if (!token) {
    return null;
  }

  try {
    return await apiRequest<PublicUser>('/auth/me', { token });
  } catch {
    return null;
  }
}
