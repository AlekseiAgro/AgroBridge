import { ApiClient } from '../api/client';
import { getConversation, listConversations, sendConversationMessage } from './api';

const BASE = 'https://api.agrobridge.ge/api';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const conversation = {
  id: 'c1',
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
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
};

describe('listConversations', () => {
  it('loads the conversation list with the bearer token', async () => {
    let method = '';
    let url = '';
    let authorization = '';
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        method = init?.method ?? 'GET';
        url = String(input);
        const headers = init?.headers as Record<string, string>;
        authorization = headers.Authorization ?? '';
        return json(200, [conversation]);
      },
    });

    const items = await listConversations(client);

    expect(method).toBe('GET');
    expect(url).toBe('https://api.agrobridge.ge/api/conversations');
    expect(authorization).toBe('Bearer jwt-1');
    expect(items).toHaveLength(1);
    expect(items[0]?.peer.displayName).toBe('Nino');
    expect(items[0]?.lastMessage?.displayText).toBe('Hello');
    expect(items[0]?.unreadCount).toBe(2);
  });

  it('returns an empty list when the account has no conversations', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async () => json(200, []),
    });

    await expect(listConversations(client)).resolves.toEqual([]);
  });

  it('rejects when the API returns an error', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async () => json(403, { message: 'Confirm your email address to access your account' }),
    });

    await expect(listConversations(client)).rejects.toMatchObject({
      status: 403,
      message: 'Confirm your email address to access your account',
    });
  });
});

describe('getConversation', () => {
  it('loads one thread with the locale and the bearer token', async () => {
    let method = '';
    let url = '';
    let authorization = '';
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        method = init?.method ?? 'GET';
        url = String(input);
        const headers = init?.headers as Record<string, string>;
        authorization = headers.Authorization ?? '';
        return json(200, {
          ...conversation,
          messages: [
            conversation.lastMessage,
            {
              ...conversation.lastMessage,
              id: 'm2',
              senderId: 'u1',
              displayText: 'Reply',
              sourceText: 'Reply',
              isMine: true,
              deliveryStatus: 'delivered',
              canShowOriginal: false,
            },
          ],
        });
      },
    });

    const detail = await getConversation(client, 'conv/1', 'ka');

    expect(method).toBe('GET');
    expect(url).toBe('https://api.agrobridge.ge/api/conversations/conv%2F1?locale=ka');
    expect(authorization).toBe('Bearer jwt-1');
    expect(detail.peer.displayName).toBe('Nino');
    expect(detail.messages.map((item) => item.displayText)).toEqual(['Hello', 'Reply']);
    expect(detail.messages[0]?.isMine).toBe(false);
    expect(detail.messages[1]?.isMine).toBe(true);
    expect(detail.messages[1]?.deliveryStatus).toBe('delivered');
  });

  it('keeps an empty message list', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async () => json(200, { ...conversation, lastMessage: null, messages: [] }),
    });

    const detail = await getConversation(client, 'c1', 'en');
    expect(detail.messages).toEqual([]);
  });

  it('rejects when the thread request fails', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async () => json(404, { message: 'Conversation not found' }),
    });

    await expect(getConversation(client, 'missing', 'en')).rejects.toMatchObject({
      status: 404,
      message: 'Conversation not found',
    });
  });
});

describe('sendConversationMessage', () => {
  it('posts the text and current locale with the bearer token', async () => {
    let method = '';
    let url = '';
    let authorization = '';
    let body = '';
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        method = init?.method ?? 'GET';
        url = String(input);
        const headers = init?.headers as Record<string, string>;
        authorization = headers.Authorization ?? '';
        body = String(init?.body ?? '');
        return json(201, {
          id: 'm9',
          conversationId: 'c1',
          senderId: 'u1',
          createdAt: '2026-10-02T12:07:00.000Z',
          sourceLocale: 'de',
          sourceText: 'Hallo',
          displayText: 'Hallo',
          translationStatus: 'none',
          isMine: true,
          canShowOriginal: false,
          deliveryStatus: 'sent',
        });
      },
    });

    const message = await sendConversationMessage(client, 'conv/1', {
      text: 'Hallo',
      sourceLocale: 'de',
    });

    expect(method).toBe('POST');
    expect(url).toBe('https://api.agrobridge.ge/api/conversations/conv%2F1/messages');
    expect(authorization).toBe('Bearer jwt-1');
    expect(JSON.parse(body)).toEqual({ text: 'Hallo', sourceLocale: 'de' });
    expect(message).toMatchObject({
      id: 'm9',
      displayText: 'Hallo',
      sourceText: 'Hallo',
      isMine: true,
      deliveryStatus: 'sent',
      sourceLocale: 'de',
    });
  });

  it('rejects when the send fails and does not invent a message', async () => {
    const client = new ApiClient({
      baseUrl: BASE,
      getAccessToken: async () => 'jwt-1',
      onUnauthorized: () => undefined,
      fetchImpl: async () => json(500, { message: 'Could not send' }),
    });

    await expect(
      sendConversationMessage(client, 'c1', { text: 'Hi', sourceLocale: 'en' }),
    ).rejects.toMatchObject({
      status: 500,
      message: 'Could not send',
    });
  });
});
