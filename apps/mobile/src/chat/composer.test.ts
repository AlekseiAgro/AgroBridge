import {
  appendSentMessage,
  canSubmitComposer,
  composerAvailable,
  composerIssue,
  draftAfterSubmit,
  messageRequestBody,
  submitComposer,
  MESSAGE_TEXT_MAX,
} from './composer';
import type { ConversationMessage } from './model';

function created(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'm-new',
    conversationId: 'c1',
    senderId: 'u1',
    createdAt: '2026-10-02T12:07:00.000Z',
    sourceLocale: 'en',
    sourceText: 'Hi',
    displayText: 'Hi',
    translationStatus: 'none',
    isMine: true,
    canShowOriginal: false,
    deliveryStatus: 'sent',
    ...overrides,
  };
}

describe('message composer', () => {
  it('is available only on a loaded thread', () => {
    expect(composerAvailable('list')).toBe(true);
    expect(composerAvailable('empty')).toBe(true);
    expect(composerAvailable('signedOut')).toBe(false);
    expect(composerAvailable('unverified')).toBe(false);
    expect(composerAvailable('loading')).toBe(false);
    expect(composerAvailable('error')).toBe(false);
  });

  it('blocks an empty draft and a draft over 4000 characters', () => {
    expect(composerIssue('')).toBe('empty');
    expect(composerIssue('   \n  ')).toBe('empty');
    expect(canSubmitComposer('   ', false)).toBe(false);
    expect(composerIssue('a'.repeat(MESSAGE_TEXT_MAX + 1))).toBe('tooLong');
    expect(canSubmitComposer('a'.repeat(MESSAGE_TEXT_MAX + 1), false)).toBe(false);
    expect(messageRequestBody('   ', 'en')).toBeNull();
  });

  it('keeps line breaks and surrounding characters in a valid draft', () => {
    expect(composerIssue('Hello')).toBeNull();
    expect(canSubmitComposer('a'.repeat(MESSAGE_TEXT_MAX), false)).toBe(true);
    expect(messageRequestBody('  Line one\nLine two  ', 'ka')).toEqual({
      text: '  Line one\nLine two  ',
      sourceLocale: 'ka',
    });
  });

  it('submits one valid message and ignores a second tap while that send is in flight', async () => {
    let resolveSend: (message: ConversationMessage) => void = () => undefined;
    const send = jest.fn(
      () =>
        new Promise<ConversationMessage>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const gate = { pending: false };
    const pending: boolean[] = [];
    const first = submitComposer({
      text: 'Hi',
      sourceLocale: 'ru',
      gate,
      send,
      onPending: (value) => pending.push(value),
    });
    const second = await submitComposer({
      text: 'Hi',
      sourceLocale: 'ru',
      gate,
      send,
      onPending: (value) => pending.push(value),
    });

    expect(second).toEqual({ status: 'ignored' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ text: 'Hi', sourceLocale: 'ru' });

    resolveSend(created());
    await expect(first).resolves.toEqual({
      status: 'sent',
      message: created(),
      sentText: 'Hi',
    });
    expect(pending).toEqual([true, false]);
    expect(draftAfterSubmit('Hi', 'Hi', true)).toBe('');
  });

  it('keeps the draft when sending fails and allows a later retry', async () => {
    const message = created();
    const send = jest
      .fn<Promise<ConversationMessage>, [{ text: string; sourceLocale: string }]>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(message);
    const gate = { pending: false };
    const failed = await submitComposer({
      text: 'Hi',
      sourceLocale: 'en',
      gate,
      send,
      onPending: () => undefined,
    });

    expect(failed).toEqual({ status: 'failed' });
    expect(draftAfterSubmit('Hi', 'Hi', false)).toBe('Hi');
    expect(gate.pending).toBe(false);

    const retried = await submitComposer({
      text: 'Hi',
      sourceLocale: 'en',
      gate,
      send,
      onPending: () => undefined,
    });
    expect(retried).toEqual({ status: 'sent', message, sentText: 'Hi' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not clear a draft the user changed while the send was in flight', () => {
    expect(draftAfterSubmit('Hi there', 'Hi', true)).toBe('Hi there');
  });
});

describe('sent message in the thread', () => {
  it('adds the returned message once and keeps it last', () => {
    const existing = created({ id: 'm1', displayText: 'Hello', createdAt: '2026-10-02T12:05:00.000Z' });
    const next = created();
    const added = appendSentMessage([existing], next);
    const again = appendSentMessage(added, { ...next, deliveryStatus: 'delivered' });

    expect(added.map((item) => item.id)).toEqual(['m1', 'm-new']);
    expect(again).toHaveLength(2);
    expect(again[1]?.deliveryStatus).toBe('delivered');
    expect(again[1]?.displayText).toBe('Hi');
  });
});
