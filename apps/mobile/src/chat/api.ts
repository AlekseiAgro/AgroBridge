import type { ApiClient } from '../api/client';
import {
  parseConversationDetail,
  parseConversationList,
  parseConversationMessage,
  type ConversationDetail,
  type ConversationMessage,
  type ConversationSummary,
} from './model';

/** Authenticated list. The API client attaches the bearer token unless auth is disabled. */
export function listConversations(api: ApiClient): Promise<ConversationSummary[]> {
  return api.request<unknown>('/conversations').then((body) => parseConversationList(body));
}

/** Authenticated thread. The server marks the conversation read when this succeeds. */
export function getConversation(
  api: ApiClient,
  conversationId: string,
  locale: string,
): Promise<ConversationDetail> {
  const params = new URLSearchParams();
  if (locale) {
    params.set('locale', locale);
  }
  const query = params.toString();
  const path = `/conversations/${encodeURIComponent(conversationId)}${query ? `?${query}` : ''}`;
  return api.request<unknown>(path).then((body) => parseConversationDetail(body));
}

/** Authenticated send. The created message from the response is the source of truth. */
export function sendConversationMessage(
  api: ApiClient,
  conversationId: string,
  body: { text: string; sourceLocale: string },
): Promise<ConversationMessage> {
  return api
    .request<unknown>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body,
    })
    .then((payload) => {
      const message = parseConversationMessage(payload);
      if (!message) {
        throw new Error('Message was not returned.');
      }
      return message;
    });
}
