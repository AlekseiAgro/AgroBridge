import type { Locale } from './locales';

export const TRANSLATION_STATUSES = ['pending', 'completed', 'failed', 'none'] as const;

export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export type ChatParticipant = {
  id: string;
  displayName: string | null;
  role: 'farmer' | 'buyer' | 'admin';
  locale: Locale;
};

export type ChatMessageView = {
  id: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  sourceLocale: Locale;
  sourceText: string;
  /** Text shown to the current viewer (translation or original). */
  displayText: string;
  translationStatus: TranslationStatus;
  isMine: boolean;
  /** True when the viewer can toggle between translation and original. */
  canShowOriginal: boolean;
};

export type ConversationSummary = {
  id: string;
  createdAt: string;
  updatedAt: string;
  peer: ChatParticipant;
  lastMessage: ChatMessageView | null;
  unreadCount: number;
};

export type ConversationDetail = ConversationSummary & {
  messages: ChatMessageView[];
};

export type UnreadMessagesCount = {
  count: number;
};
