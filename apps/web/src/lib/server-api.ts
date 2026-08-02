import { getAuthToken } from './auth-cookie';
import { apiRequest } from './api';

export async function apiRequestAuthed<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
  } = {},
): Promise<T> {
  const token = await getAuthToken();
  return apiRequest<T>(path, { ...options, token });
}
