import {
  conversationActivityAt,
  conversationListPhase,
  shouldLoadConversations,
  toConversationRow,
} from './list';
import type { ConversationSummary } from './model';

const labels = { unknownPeer: 'User', noPreview: 'No messages yet' };

function conversation(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: 'c1',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    peer: {
      id: 'u2',
      displayName: 'Nino',
      role: 'farmer',
      locale: 'ka',
      avatarUrl: null,
    },
    lastMessage: {
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u2',
      createdAt: '2026-10-02T10:00:00.000Z',
      sourceLocale: 'en',
      sourceText: 'Hello',
      displayText: 'Hello',
      translationStatus: 'none',
      isMine: false,
      canShowOriginal: false,
      deliveryStatus: null,
    },
    unreadCount: 2,
    ...overrides,
  };
}

describe('conversation list access', () => {
  it('loads only for a verified account', () => {
    expect(shouldLoadConversations(null)).toBe(false);
    expect(shouldLoadConversations({ emailVerified: false })).toBe(false);
    expect(shouldLoadConversations({ emailVerified: true })).toBe(true);
  });

  it('keeps signed-out and unverified users off the request', () => {
    expect(
      conversationListPhase({
        authStatus: 'anonymous',
        user: null,
        profileUnavailable: false,
        loadStatus: 'idle',
        count: 0,
      }),
    ).toBe('signedOut');
    expect(
      conversationListPhase({
        authStatus: 'authenticated',
        user: { emailVerified: false },
        profileUnavailable: false,
        loadStatus: 'idle',
        count: 0,
      }),
    ).toBe('unverified');
  });
});

describe('conversation list states', () => {
  const verified = {
    authStatus: 'authenticated' as const,
    user: { emailVerified: true },
    profileUnavailable: false,
  };

  it('reports loading before the list is ready', () => {
    expect(conversationListPhase({ ...verified, loadStatus: 'loading', count: 0 })).toBe('loading');
    expect(conversationListPhase({ ...verified, loadStatus: 'idle', count: 0 })).toBe('loading');
  });

  it('reports an empty list and an error separately', () => {
    expect(conversationListPhase({ ...verified, loadStatus: 'ready', count: 0 })).toBe('empty');
    expect(conversationListPhase({ ...verified, loadStatus: 'error', count: 0 })).toBe('error');
  });

  it('reports a list when conversations exist', () => {
    expect(conversationListPhase({ ...verified, loadStatus: 'ready', count: 1 })).toBe('list');
  });
});

describe('conversation row', () => {
  it('shows the peer name, last message, activity time, and unread count', () => {
    const item = conversation();
    const row = toConversationRow(item, labels);

    expect(row.name).toBe('Nino');
    expect(row.preview).toBe('Hello');
    expect(row.unreadCount).toBe(2);
    expect(row.activityAt).toBe('2026-10-02T10:00:00.000Z');
    expect(conversationActivityAt(item)).toBe(item.lastMessage?.createdAt);
  });

  it('uses the creation time when the conversation has no messages', () => {
    const item = conversation({ lastMessage: null, unreadCount: 0 });
    const row = toConversationRow(item, labels);

    expect(row.preview).toBe('No messages yet');
    expect(row.unreadCount).toBe(0);
    expect(row.activityAt).toBe(item.createdAt);
  });

  it('falls back when the peer has no display name', () => {
    const item = conversation({
      peer: { ...conversation().peer, displayName: '  ' },
    });
    expect(toConversationRow(item, labels).name).toBe('User');
  });
});
