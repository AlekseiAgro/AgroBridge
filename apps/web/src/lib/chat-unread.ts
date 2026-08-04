import type { UnreadMessagesCount } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

/** Server-side unread chat count for nav badges. Returns 0 when unauthenticated/unavailable. */
export async function getUnreadMessagesCount(): Promise<number> {
  try {
    const data = await apiRequestAuthed<UnreadMessagesCount>('/conversations/unread-count');
    return typeof data.count === 'number' && data.count > 0 ? data.count : 0;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return 0;
    }
    return 0;
  }
}
