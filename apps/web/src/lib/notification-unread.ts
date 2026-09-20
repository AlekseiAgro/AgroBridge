import type { NotificationUnreadSummary } from '@agrobridge/shared';
import { EMPTY_NOTIFICATION_UNREAD_SUMMARY } from '@agrobridge/shared';
import { ApiError } from '@/lib/api';
import { apiRequestAuthed } from '@/lib/server-api';

/** Server-side in-app unread counts for cabinet badges. Returns zeros when unauthenticated. */
export async function getNotificationUnreadCounts(): Promise<NotificationUnreadSummary> {
  try {
    const data = await apiRequestAuthed<NotificationUnreadSummary>('/notifications/unread-count');
    return {
      count: Math.max(0, data.totalUnread ?? data.count ?? 0),
      totalUnread: Math.max(0, data.totalUnread ?? data.count ?? 0),
      purchaseRequestsUnread: Math.max(0, data.purchaseRequestsUnread ?? 0),
      quotesUnread: Math.max(0, data.quotesUnread ?? 0),
      pendingQuotesUnread: Math.max(0, data.pendingQuotesUnread ?? 0),
      acceptedQuotesUnread: Math.max(0, data.acceptedQuotesUnread ?? 0),
    };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { ...EMPTY_NOTIFICATION_UNREAD_SUMMARY };
    }
    return { ...EMPTY_NOTIFICATION_UNREAD_SUMMARY };
  }
}
