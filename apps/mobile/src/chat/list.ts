import type { ConversationSummary } from './model';

export type ConversationListPhase =
  | 'session'
  | 'signedOut'
  | 'unverified'
  | 'profileUnavailable'
  | 'loading'
  | 'error'
  | 'empty'
  | 'list';

export type ConversationRow = {
  id: string;
  name: string;
  preview: string;
  activityAt: string;
  unreadCount: number;
  avatarUrl: string | null;
};

/** The conversations endpoint requires a verified email. */
export function shouldLoadConversations(user: { emailVerified: boolean } | null | undefined): boolean {
  return user?.emailVerified === true;
}

export function conversationListPhase(input: {
  authStatus: 'loading' | 'anonymous' | 'authenticated';
  user: { emailVerified: boolean } | null;
  profileUnavailable: boolean;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  count: number;
}): ConversationListPhase {
  if (input.authStatus === 'loading') {
    return 'session';
  }
  if (input.profileUnavailable) {
    return 'profileUnavailable';
  }
  if (!input.user) {
    return 'signedOut';
  }
  if (!input.user.emailVerified) {
    return 'unverified';
  }
  if (input.loadStatus === 'error') {
    return 'error';
  }
  if (input.loadStatus !== 'ready') {
    return 'loading';
  }
  return input.count === 0 ? 'empty' : 'list';
}

/** Last message time, or the conversation creation time when the thread is empty. */
export function conversationActivityAt(item: Pick<ConversationSummary, 'createdAt' | 'lastMessage'>): string {
  return item.lastMessage?.createdAt || item.createdAt;
}

export function toConversationRow(
  item: ConversationSummary,
  labels: { unknownPeer: string; noPreview: string },
): ConversationRow {
  const name = item.peer.displayName?.trim() || labels.unknownPeer;
  const preview = item.lastMessage?.displayText.trim() || item.lastMessage?.sourceText.trim() || labels.noPreview;
  return {
    id: item.id,
    name,
    preview,
    activityAt: conversationActivityAt(item),
    unreadCount: item.unreadCount,
    avatarUrl: item.peer.avatarUrl,
  };
}
