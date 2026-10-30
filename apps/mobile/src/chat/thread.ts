import type { ConversationMessage } from './model';

export type MessageAlign = 'mine' | 'peer';

export type ThreadRoute = {
  screen: 'ConversationThread';
  params: { conversationId: string };
};

export function conversationThreadParams(conversationId: string): ThreadRoute {
  return { screen: 'ConversationThread', params: { conversationId } };
}

/** Oldest first. Equal timestamps keep a stable id order. */
export function chronologicalMessages(messages: readonly ConversationMessage[]): ConversationMessage[] {
  return [...messages].sort((left, right) => {
    const byTime = left.createdAt.localeCompare(right.createdAt);
    return byTime === 0 ? left.id.localeCompare(right.id) : byTime;
  });
}

export function messageAlign(message: Pick<ConversationMessage, 'isMine'>): MessageAlign {
  return message.isMine ? 'mine' : 'peer';
}

/** Uses the API text. Original is shown only when that message allows it. */
export function messageBody(message: ConversationMessage, showOriginal: boolean): string {
  if (showOriginal && message.canShowOriginal) {
    return message.sourceText;
  }
  return message.displayText;
}

export type ThreadDateKind = 'today' | 'yesterday' | 'date';

export type ThreadRow =
  | { type: 'date'; id: string; kind: ThreadDateKind; createdAt: string }
  | { type: 'message'; message: ConversationMessage };

/** Peer name, or the signed-in name/email. Blank names use the existing unknown-person label. */
export function messageSenderName(
  isMine: boolean,
  names: {
    mineDisplayName: string | null | undefined;
    mineEmail: string | null | undefined;
    peerDisplayName: string | null | undefined;
  },
  fallback: string,
): string {
  const preferred = isMine ? names.mineDisplayName : names.peerDisplayName;
  const trimmed = preferred?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (isMine) {
    const email = names.mineEmail?.trim();
    if (email) {
      return email;
    }
  }
  return fallback;
}

function calendarDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function threadDateKind(createdAt: string, now: Date): ThreadDateKind | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (calendarDay(date) === calendarDay(now)) {
    return 'today';
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (calendarDay(date) === calendarDay(yesterday)) {
    return 'yesterday';
  }
  return 'date';
}

/** One separator when the local calendar day changes. Messages stay oldest first. */
export function threadRows(messages: readonly ConversationMessage[], now: Date): ThreadRow[] {
  const rows: ThreadRow[] = [];
  let previousDay: string | null = null;
  for (const message of chronologicalMessages(messages)) {
    const date = new Date(message.createdAt);
    const day = Number.isNaN(date.getTime()) ? null : calendarDay(date);
    if (day && day !== previousDay) {
      const kind = threadDateKind(message.createdAt, now);
      if (kind) {
        rows.push({ type: 'date', id: `date-${day}`, kind, createdAt: message.createdAt });
      }
      previousDay = day;
    }
    rows.push({ type: 'message', message });
  }
  return rows;
}

/** Full calendar date in the active locale. Today and yesterday stay in the translation files. */
export function formatThreadDate(createdAt: string, locale: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function nextOriginalVisibility(
  current: ReadonlySet<string>,
  messageId: string,
  canShowOriginal: boolean,
): Set<string> {
  const next = new Set(current);
  if (!canShowOriginal) {
    return next;
  }
  if (next.has(messageId)) {
    next.delete(messageId);
  } else {
    next.add(messageId);
  }
  return next;
}
