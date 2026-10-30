import { appendSentMessage } from './composer';
import { conversationListPhase } from './list';
import type { ConversationMessage } from './model';
import {
  chronologicalMessages,
  conversationThreadParams,
  formatThreadDate,
  messageAlign,
  messageBody,
  messageSenderName,
  nextOriginalVisibility,
  threadDateKind,
  threadRows,
} from './thread';

function message(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    createdAt: '2026-10-02T10:00:00.000Z',
    sourceLocale: 'ka',
    sourceText: 'გამარჯობა',
    displayText: 'Hello',
    translationStatus: 'completed',
    isMine: false,
    canShowOriginal: true,
    deliveryStatus: null,
    ...overrides,
  };
}

const verified = {
  authStatus: 'authenticated' as const,
  user: { emailVerified: true },
  profileUnavailable: false,
};

describe('conversation thread navigation', () => {
  it('opens ConversationThread with the conversation id', () => {
    expect(conversationThreadParams('c1')).toEqual({
      screen: 'ConversationThread',
      params: { conversationId: 'c1' },
    });
  });
});

describe('conversation thread messages', () => {
  it('orders messages from oldest to newest and aligns own messages apart from the peer', () => {
    const newer = message({ id: 'm2', createdAt: '2026-10-02T11:00:00.000Z', isMine: true, deliveryStatus: 'read' });
    const older = message({ id: 'm1', createdAt: '2026-10-02T10:00:00.000Z', isMine: false });
    const ordered = chronologicalMessages([newer, older]);

    expect(ordered.map((item) => item.id)).toEqual(['m1', 'm2']);
    expect(messageAlign(ordered[0])).toBe('peer');
    expect(messageAlign(ordered[1])).toBe('mine');
    expect(ordered[1]?.deliveryStatus).toBe('read');
  });

  it('shows displayText until the original is requested for that message', () => {
    const item = message();
    expect(messageBody(item, false)).toBe('Hello');

    const shown = nextOriginalVisibility(new Set(), item.id, item.canShowOriginal);
    expect(shown.has(item.id)).toBe(true);
    expect(messageBody(item, true)).toBe('გამარჯობა');

    const hidden = nextOriginalVisibility(shown, item.id, true);
    expect(hidden.has(item.id)).toBe(false);
  });

  it('does not reveal the original when the API disallows it', () => {
    const item = message({ canShowOriginal: false });
    const shown = nextOriginalVisibility(new Set(), item.id, item.canShowOriginal);
    expect(shown.has(item.id)).toBe(false);
    expect(messageBody(item, true)).toBe('Hello');
  });
});

describe('message sender names', () => {
  const names = {
    mineDisplayName: 'Ada',
    mineEmail: 'ada@example.com',
    peerDisplayName: 'Nino',
  };

  it('uses the peer name for an incoming message and the signed-in name for an outgoing one', () => {
    expect(messageSenderName(false, names, 'User')).toBe('Nino');
    expect(messageSenderName(true, names, 'User')).toBe('Ada');
  });

  it('falls back when a display name is missing', () => {
    expect(
      messageSenderName(false, { ...names, peerDisplayName: '  ' }, 'User'),
    ).toBe('User');
    expect(
      messageSenderName(true, { ...names, mineDisplayName: null }, 'User'),
    ).toBe('ada@example.com');
    expect(
      messageSenderName(true, { mineDisplayName: null, mineEmail: ' ', peerDisplayName: 'Nino' }, 'User'),
    ).toBe('User');
  });
});

describe('thread date separators', () => {
  const now = new Date(2026, 9, 2, 15, 0, 0);

  function at(year: number, monthIndex: number, day: number, hour: number): string {
    return new Date(year, monthIndex, day, hour).toISOString();
  }

  it('inserts one separator per calendar day and keeps oldest-to-newest order', () => {
    const older = message({ id: 'old', createdAt: at(2026, 8, 15, 9), isMine: false });
    const yesterdayEarly = message({ id: 'y1', createdAt: at(2026, 9, 1, 13), isMine: false });
    const yesterdayLate = message({ id: 'y2', createdAt: at(2026, 9, 1, 18), isMine: true });
    const todayEarly = message({ id: 't1', createdAt: at(2026, 9, 2, 12), isMine: false });
    const todayLate = message({ id: 't2', createdAt: at(2026, 9, 2, 12), isMine: true });
    const rows = threadRows([todayLate, yesterdayLate, older, todayEarly, yesterdayEarly], now);

    expect(rows.filter((row) => row.type === 'date')).toHaveLength(3);
    expect(
      rows.filter((row) => row.type === 'message').map((row) => (row.type === 'message' ? row.message.id : '')),
    ).toEqual(['old', 'y1', 'y2', 't1', 't2']);
    expect(rows.filter((row) => row.type === 'date').map((row) => (row.type === 'date' ? row.kind : ''))).toEqual([
      'date',
      'yesterday',
      'today',
    ]);
  });

  it('labels today, yesterday, and an older localized date', () => {
    expect(threadDateKind(at(2026, 9, 2, 12), now)).toBe('today');
    expect(threadDateKind(at(2026, 9, 1, 13), now)).toBe('yesterday');
    expect(threadDateKind(at(2026, 8, 15, 9), now)).toBe('date');
    expect(formatThreadDate(at(2026, 9, 1, 13), 'en')).toMatch(/2026/);
    expect(formatThreadDate(at(2026, 9, 1, 13), 'ru')).toMatch(/2026/);
    expect(formatThreadDate(at(2026, 9, 1, 13), 'ru')).toMatch(/октябр/i);
  });
});

describe('sent message in the thread', () => {
  const now = new Date(2026, 9, 2, 15, 0, 0);

  it('shows the returned message immediately, last, without a second date separator', () => {
    const older = message({
      id: 'm1',
      createdAt: new Date(2026, 9, 2, 12, 5).toISOString(),
      isMine: false,
      displayText: 'Hello',
    });
    const sent = message({
      id: 'm2',
      createdAt: new Date(2026, 9, 2, 12, 7).toISOString(),
      isMine: true,
      displayText: 'Hi',
      sourceText: 'Hi',
      deliveryStatus: 'sent',
      canShowOriginal: false,
    });
    const rows = threadRows(appendSentMessage([older], sent), now);
    const messages = rows.filter((row) => row.type === 'message');

    expect(rows.filter((row) => row.type === 'date')).toHaveLength(1);
    expect(messages.map((row) => (row.type === 'message' ? row.message.id : ''))).toEqual(['m1', 'm2']);
    expect(rows[rows.length - 1]).toMatchObject({ type: 'message', message: { id: 'm2', displayText: 'Hi' } });
    expect(messageAlign(sent)).toBe('mine');
    expect(messageSenderName(true, { mineDisplayName: 'Ada', mineEmail: 'ada@example.com', peerDisplayName: 'Nino' }, 'User')).toBe(
      'Ada',
    );
  });
});

describe('conversation thread states', () => {
  it('reports loading, an empty thread, and an error', () => {
    expect(conversationListPhase({ ...verified, loadStatus: 'loading', count: 0 })).toBe('loading');
    expect(conversationListPhase({ ...verified, loadStatus: 'ready', count: 0 })).toBe('empty');
    expect(conversationListPhase({ ...verified, loadStatus: 'error', count: 0 })).toBe('error');
    expect(conversationListPhase({ ...verified, loadStatus: 'ready', count: 2 })).toBe('list');
  });
});
