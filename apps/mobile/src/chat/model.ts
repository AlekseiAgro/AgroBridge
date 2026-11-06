/** Matches GET /conversations. Fields the API does not send are not included. */

export type ConversationPeer = {
  id: string;
  displayName: string | null;
  role: 'farmer' | 'buyer' | 'admin';
  locale: string;
  avatarUrl: string | null;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  sourceLocale: string;
  sourceText: string;
  displayText: string;
  translationStatus: 'pending' | 'completed' | 'failed' | 'none';
  isMine: boolean;
  canShowOriginal: boolean;
  deliveryStatus: 'sent' | 'delivered' | 'read' | null;
};

export type ConversationSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  peer: ConversationPeer;
  lastMessage: ConversationMessage | null;
  unreadCount: number;
};

/** GET /conversations/:id. Opening it marks the thread read on the server. */
export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[];
};

const ROLES = new Set(['farmer', 'buyer', 'admin']);
const TRANSLATION = new Set(['pending', 'completed', 'failed', 'none']);
const DELIVERY = new Set(['sent', 'delivered', 'read']);

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parsePeer(value: unknown): ConversationPeer | null {
  const row = record(value);
  if (!row || typeof row.id !== 'string' || !ROLES.has(String(row.role))) {
    return null;
  }
  return {
    id: row.id,
    displayName: typeof row.displayName === 'string' ? row.displayName : null,
    role: row.role as ConversationPeer['role'],
    locale: text(row.locale),
    avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
  };
}

export function parseConversationMessage(value: unknown): ConversationMessage | null {
  const row = record(value);
  if (!row || typeof row.id !== 'string') {
    return null;
  }
  const translationStatus = TRANSLATION.has(String(row.translationStatus))
    ? (row.translationStatus as ConversationMessage['translationStatus'])
    : 'none';
  const deliveryStatus = DELIVERY.has(String(row.deliveryStatus))
    ? (row.deliveryStatus as Exclude<ConversationMessage['deliveryStatus'], null>)
    : null;
  return {
    id: row.id,
    conversationId: text(row.conversationId),
    senderId: text(row.senderId),
    createdAt: text(row.createdAt),
    sourceLocale: text(row.sourceLocale),
    sourceText: text(row.sourceText),
    displayText: text(row.displayText),
    translationStatus,
    isMine: row.isMine === true,
    canShowOriginal: row.canShowOriginal === true,
    deliveryStatus,
  };
}

function parseSummary(row: Record<string, unknown>): ConversationSummary | null {
  const peer = parsePeer(row.peer);
  if (typeof row.id !== 'string' || !peer) {
    return null;
  }
  const unread = typeof row.unreadCount === 'number' && Number.isFinite(row.unreadCount) ? row.unreadCount : 0;
  return {
    id: row.id,
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt),
    peer,
    lastMessage: parseConversationMessage(row.lastMessage),
    unreadCount: Math.max(0, unread),
  };
}

export function parseConversationList(body: unknown): ConversationSummary[] {
  if (!Array.isArray(body)) {
    throw new Error('Conversation list was not an array.');
  }
  const items: ConversationSummary[] = [];
  for (const entry of body) {
    const row = record(entry);
    const summary = row ? parseSummary(row) : null;
    if (summary) {
      items.push(summary);
    }
  }
  return items;
}

export function parseConversationDetail(body: unknown): ConversationDetail {
  const row = record(body);
  const summary = row ? parseSummary(row) : null;
  if (!row || !summary) {
    throw new Error('Conversation was not returned.');
  }
  if (!Array.isArray(row.messages)) {
    throw new Error('Conversation messages were not a list.');
  }
  const messages: ConversationMessage[] = [];
  for (const entry of row.messages) {
    const message = parseConversationMessage(entry);
    if (message) {
      messages.push(message);
    }
  }
  return { ...summary, messages };
}
