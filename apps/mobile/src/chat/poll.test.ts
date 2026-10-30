import { appendSentMessage } from './composer';
import type { ConversationDetail, ConversationMessage } from './model';
import {
  THREAD_POLL_INTERVAL_MS,
  applyConversationPoll,
  createThreadPoller,
  loadOpenThread,
  mergePolledMessages,
  nextThreadLoadStatus,
  shouldShowThreadLoading,
  threadIsNearBottom,
  threadPollingEnabled,
} from './poll';

function message(id: string, createdAt: string, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    conversationId: 'c1',
    senderId: 'u2',
    createdAt,
    sourceLocale: 'en',
    sourceText: id,
    displayText: id,
    translationStatus: 'none',
    isMine: false,
    canShowOriginal: false,
    deliveryStatus: null,
    ...overrides,
  };
}

function detail(messages: ConversationMessage[]): ConversationDetail {
  return {
    id: 'c1',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z',
    peer: { id: 'u2', displayName: 'Nino', role: 'farmer', locale: 'ka', avatarUrl: null },
    lastMessage: messages[messages.length - 1] ?? null,
    unreadCount: 0,
    messages,
  };
}

describe('thread polling lifecycle', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts when the thread is open and polls every 4 seconds', async () => {
    jest.useFakeTimers();
    const modes: string[] = [];
    const poller = createThreadPoller({
      enabled: threadPollingEnabled({ emailVerified: true }),
      refresh: (mode) => {
        modes.push(mode);
      },
    });

    expect(THREAD_POLL_INTERVAL_MS).toBe(4000);
    expect(modes).toEqual(['initial']);
    await Promise.resolve();
    jest.advanceTimersByTime(3999);
    expect(modes).toEqual(['initial']);
    jest.advanceTimersByTime(1);
    expect(modes).toEqual(['initial', 'poll']);
    await Promise.resolve();
    jest.advanceTimersByTime(4000);
    expect(modes).toEqual(['initial', 'poll', 'poll']);
    poller.stop();
  });

  it('stops when the screen loses focus', async () => {
    jest.useFakeTimers();
    const modes: string[] = [];
    const poller = createThreadPoller({
      enabled: true,
      refresh: (mode) => {
        modes.push(mode);
      },
    });
    await Promise.resolve();
    poller.stop();
    jest.advanceTimersByTime(THREAD_POLL_INTERVAL_MS * 3);
    expect(modes).toEqual(['initial']);
  });

  it('stops on unmount', async () => {
    jest.useFakeTimers();
    const modes: string[] = [];
    const poller = createThreadPoller({
      enabled: true,
      refresh: (mode) => {
        modes.push(mode);
      },
    });
    await Promise.resolve();
    poller.stop();
    jest.advanceTimersByTime(THREAD_POLL_INTERVAL_MS);
    expect(modes).toEqual(['initial']);
  });

  it('does not poll a signed-out or unverified session', () => {
    jest.useFakeTimers();
    const refresh = jest.fn();
    createThreadPoller({ enabled: threadPollingEnabled(null), refresh });
    createThreadPoller({ enabled: threadPollingEnabled({ emailVerified: false }), refresh });
    jest.advanceTimersByTime(THREAD_POLL_INTERVAL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('skips a tick while a refresh is still in flight', async () => {
    jest.useFakeTimers();
    let release: () => void = () => undefined;
    const modes: string[] = [];
    const poller = createThreadPoller({
      enabled: true,
      refresh: (mode) => {
        modes.push(mode);
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    jest.advanceTimersByTime(THREAD_POLL_INTERVAL_MS);
    expect(modes).toEqual(['initial']);
    release();
    await Promise.resolve();
    jest.advanceTimersByTime(THREAD_POLL_INTERVAL_MS);
    expect(modes).toEqual(['initial', 'poll']);
    poller.stop();
  });

  it('loads with the current locale', async () => {
    const load = jest.fn(async () => detail([]));
    await loadOpenThread(load, 'conv/1', 'de');
    expect(load).toHaveBeenCalledWith('conv/1', 'de');
  });
});

describe('thread polling presentation', () => {
  it('shows the skeleton only for the first load', () => {
    expect(shouldShowThreadLoading('initial', false)).toBe(true);
    expect(shouldShowThreadLoading('poll', false)).toBe(false);
    expect(shouldShowThreadLoading('initial', true)).toBe(false);
    expect(shouldShowThreadLoading('poll', true)).toBe(false);
  });

  it('keeps the open thread when a background poll fails', () => {
    expect(
      nextThreadLoadStatus({ mode: 'initial', hasLoaded: false, failed: true, current: 'loading' }),
    ).toBe('error');
    expect(
      nextThreadLoadStatus({ mode: 'poll', hasLoaded: true, failed: true, current: 'ready' }),
    ).toBe('ready');
    expect(
      nextThreadLoadStatus({ mode: 'poll', hasLoaded: true, failed: false, current: 'ready' }),
    ).toBe('ready');
  });
});

describe('polled message merge', () => {
  const older = message('A', '2026-10-02T12:00:00.000Z');
  const middle = message('B', '2026-10-02T12:01:00.000Z');
  const sent = message('C', '2026-10-02T12:02:00.000Z', {
    isMine: true,
    displayText: 'Hi',
    sourceText: 'Hi',
    deliveryStatus: 'sent',
  });

  it('adds a message from the server without duplicating the ones already shown', () => {
    const merged = mergePolledMessages([older, middle], [older, middle, sent]);
    expect(merged.map((item) => item.id)).toEqual(['A', 'B', 'C']);
  });

  it('keeps a just-sent message when an older snapshot arrives', () => {
    const current = detail(appendSentMessage([older, middle], sent));
    const polled = applyConversationPoll(current, detail([older, middle]));
    expect(polled.messages.map((item) => item.id)).toEqual(['A', 'B', 'C']);
    expect(polled.messages).toHaveLength(3);
  });

  it('does not duplicate a message the poll and the screen both already have', () => {
    const merged = mergePolledMessages([older, middle, sent], [older, middle, sent]);
    expect(merged).toHaveLength(3);
    expect(merged.map((item) => item.id)).toEqual(['A', 'B', 'C']);
  });

  it('updates delivery status on the existing message', () => {
    const delivered = mergePolledMessages([sent], [{ ...sent, deliveryStatus: 'delivered' }]);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.deliveryStatus).toBe('delivered');
    const read = mergePolledMessages(delivered, [{ ...sent, deliveryStatus: 'read' }]);
    expect(read).toHaveLength(1);
    expect(read[0]?.id).toBe('C');
    expect(read[0]?.deliveryStatus).toBe('read');
  });

  it('keeps oldest-to-newest order when the snapshot is unsorted', () => {
    const merged = mergePolledMessages([sent, older], [middle]);
    expect(merged.map((item) => item.id)).toEqual(['A', 'B', 'C']);
  });
});

describe('thread scroll position', () => {
  it('stays with the latest message only while the reader is near the bottom', () => {
    expect(threadIsNearBottom(0, 400, 300)).toBe(true);
    expect(threadIsNearBottom(500, 400, 900)).toBe(true);
    expect(threadIsNearBottom(0, 400, 900)).toBe(false);
  });
});
