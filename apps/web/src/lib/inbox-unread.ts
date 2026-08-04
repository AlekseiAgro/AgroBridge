import type { PendingInboxCount } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

/** Server-side pending inbox count for nav badges. Returns 0 when unavailable. */
export async function getPendingInboxCount(): Promise<number> {
  try {
    const data = await apiRequestAuthed<PendingInboxCount>('/rfqs/inbox/unread-count');
    return typeof data.count === 'number' && data.count > 0 ? data.count : 0;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return 0;
    }
    return 0;
  }
}
