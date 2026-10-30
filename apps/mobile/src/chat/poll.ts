import { shouldLoadConversations } from './list';
import type { ConversationDetail, ConversationMessage } from './model';
import { chronologicalMessages } from './thread';

/** Same cadence as the web conversation room. */
export const THREAD_POLL_INTERVAL_MS = 4000;

/** Treat the reader as near the latest message inside this distance. */
export const THREAD_NEAR_BOTTOM_PX = 96;

export type ThreadRefreshMode = 'initial' | 'poll';

export type ThreadLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type Timer = ReturnType<typeof setInterval>;

/** Signed-out and unverified sessions never open the thread request. */
export function threadPollingEnabled(
  user: { emailVerified: boolean } | null | undefined,
): boolean {
  return shouldLoadConversations(user);
}

/** The full-screen skeleton is only for the first load of this conversation. */
export function shouldShowThreadLoading(mode: ThreadRefreshMode, hasLoaded: boolean): boolean {
  return mode === 'initial' && !hasLoaded;
}

/** A later refresh must not replace a visible thread with the error screen. */
export function shouldKeepThreadAfterRefreshError(mode: ThreadRefreshMode, hasLoaded: boolean): boolean {
  return mode === 'poll' || hasLoaded;
}

export function nextThreadLoadStatus(input: {
  mode: ThreadRefreshMode;
  hasLoaded: boolean;
  failed: boolean;
  current: ThreadLoadStatus;
}): ThreadLoadStatus {
  if (!input.failed) {
    return 'ready';
  }
  if (shouldKeepThreadAfterRefreshError(input.mode, input.hasLoaded)) {
    return input.current === 'loading' ? 'ready' : input.current;
  }
  return 'error';
}

export function loadOpenThread(
  load: (conversationId: string, locale: string) => Promise<ConversationDetail>,
  conversationId: string,
  locale: string,
): Promise<ConversationDetail> {
  return load(conversationId, locale);
}

/**
 * Server fields replace the same id. Messages the server snapshot does not
 * contain yet stay on screen, so a slow poll cannot drop a message just sent.
 */
export function mergePolledMessages(
  current: readonly ConversationMessage[],
  incoming: readonly ConversationMessage[],
): ConversationMessage[] {
  const byId = new Map<string, ConversationMessage>();
  for (const message of current) {
    byId.set(message.id, message);
  }
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  return chronologicalMessages([...byId.values()]);
}

export function applyConversationPoll(
  current: ConversationDetail | null,
  incoming: ConversationDetail,
): ConversationDetail {
  if (!current) {
    return incoming;
  }
  const messages = mergePolledMessages(current.messages, incoming.messages);
  return {
    ...incoming,
    messages,
    lastMessage: messages.length > 0 ? messages[messages.length - 1] : incoming.lastMessage,
  };
}

export function threadIsNearBottom(offsetY: number, viewportHeight: number, contentHeight: number): boolean {
  if (contentHeight <= viewportHeight) {
    return true;
  }
  return contentHeight - viewportHeight - offsetY <= THREAD_NEAR_BOTTOM_PX;
}

/**
 * One immediate load, then a refresh on the interval.
 * A refresh still in flight is skipped. `stop` clears the interval.
 */
export function createThreadPoller(options: {
  enabled: boolean;
  refresh: (mode: ThreadRefreshMode) => Promise<void> | void;
  intervalMs?: number;
  schedule?: (callback: () => void, intervalMs: number) => Timer;
  cancel?: (timer: Timer) => void;
}): { stop: () => void } {
  if (!options.enabled) {
    return { stop() {} };
  }

  let stopped = false;
  let inFlight = false;
  const schedule = options.schedule ?? setInterval;
  const cancel = options.cancel ?? clearInterval;

  const run = (mode: ThreadRefreshMode) => {
    if (stopped || inFlight) {
      return;
    }
    inFlight = true;
    Promise.resolve(options.refresh(mode)).finally(() => {
      inFlight = false;
    });
  };

  run('initial');
  const timer = schedule(() => {
    run('poll');
  }, options.intervalMs ?? THREAD_POLL_INTERVAL_MS);

  return {
    stop() {
      stopped = true;
      cancel(timer);
    },
  };
}
