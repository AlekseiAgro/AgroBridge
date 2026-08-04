'use client';

import type {
  ChatMessageView,
  ChatParticipant,
  ConversationDetail,
  MessageDeliveryStatus,
} from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ChatAvatar } from '@/components/ChatAvatar';
import { requestChatUnreadRefresh } from '@/components/ChatNavLink';

type Viewer = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type Props = {
  conversationId: string;
  initial: ConversationDetail;
  viewer: Viewer;
  peer: ChatParticipant;
};

function DeliveryTicks({ status }: { status: MessageDeliveryStatus }) {
  const t = useTranslations('chat');
  const label = t(`delivery.${status}`);
  const marks = status === 'sent' ? '✓' : '✓✓';
  const className =
    status === 'read'
      ? 'chat-delivery chat-delivery--read'
      : status === 'delivered'
        ? 'chat-delivery chat-delivery--delivered'
        : 'chat-delivery';
  return (
    <span className={className} title={label} aria-label={label}>
      {marks}
    </span>
  );
}

export function ChatRoom({ conversationId, initial, viewer, peer }: Props) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessageView[]>(initial.messages);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initial.messages);
  }, [initial]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    requestChatUnreadRefresh();

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}?locale=${encodeURIComponent(locale)}`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
          },
        );
        if (!response.ok) return;
        const data = (await response.json()) as ConversationDetail;
        setMessages(data.messages);
        requestChatUnreadRefresh();
      } catch {
        // ignore polling errors
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [conversationId, locale]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}?locale=${encodeURIComponent(locale)}`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
          },
        );
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as ConversationDetail;
        if (!cancelled) setMessages(data.messages);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, locale]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || pending) return;

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceLocale: locale }),
      });
      const data = (await response.json()) as ChatMessageView & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }
      setMessages((current) => [...current, data]);
      setText('');
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="chat-room">
      <div className="chat-thread" ref={threadRef}>
        {messages.length === 0 ? <p className="empty-state">{t('emptyThread')}</p> : null}
        {messages.map((message) => {
          const authorName = message.isMine
            ? viewer.displayName || t('you')
            : peer.displayName || peer.role;
          const authorAvatar = message.isMine ? viewer.avatarUrl : peer.avatarUrl;
          const timeLabel = new Date(message.createdAt).toLocaleString();

          return (
            <article
              key={message.id}
              className={
                message.isMine ? 'chat-row chat-row--mine' : 'chat-row chat-row--peer'
              }
            >
              {!message.isMine ? (
                <ChatAvatar name={authorName} avatarUrl={authorAvatar} />
              ) : null}
              <div className="chat-row__stack">
                <div
                  className={
                    message.isMine
                      ? 'chat-bubble chat-bubble--mine'
                      : 'chat-bubble chat-bubble--peer'
                  }
                >
                  <p className="chat-bubble__text">{message.sourceText}</p>
                </div>
                <div className="chat-row__meta">
                  <span>{timeLabel}</span>
                  {message.isMine && message.deliveryStatus ? (
                    <DeliveryTicks status={message.deliveryStatus} />
                  ) : null}
                </div>
              </div>
              {message.isMine ? (
                <ChatAvatar name={authorName} avatarUrl={authorAvatar} />
              ) : null}
            </article>
          );
        })}
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        <label className="field chat-composer__field">
          <span className="sr-only">{t('message')}</span>
          <textarea
            rows={2}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onComposerKeyDown}
            onFocus={(event) => {
              event.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }}
            placeholder={t('messagePlaceholder')}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? t('pleaseWait') : t('send')}
        </button>
      </form>
    </div>
  );
}
