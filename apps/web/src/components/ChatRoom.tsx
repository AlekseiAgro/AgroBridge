'use client';

import type { ChatMessageView, ConversationDetail } from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { requestChatUnreadRefresh } from '@/components/ChatNavLink';

type Props = {
  conversationId: string;
  initial: ConversationDetail;
};

export function ChatRoom({ conversationId, initial }: Props) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessageView[]>(initial.messages);
  const [peerName] = useState(initial.peer.displayName || initial.peer.role);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showOriginalIds, setShowOriginalIds] = useState<Record<string, boolean>>({});

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
    if (!text.trim()) return;

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

  return (
    <div className="chat-room">
      <p className="page__subtitle">
        {t('chattingWith', { name: peerName })} · {t('aiHint')}
      </p>

      <div className="chat-thread">
        {messages.length === 0 ? <p className="empty-state">{t('emptyThread')}</p> : null}
        {messages.map((message) => {
          const showOriginal = !!showOriginalIds[message.id];
          const canToggleOriginal =
            message.canShowOriginal ||
            (!message.isMine &&
              message.sourceText !== message.displayText &&
              Boolean(message.displayText));
          return (
            <article
              key={message.id}
              className={`chat-bubble ${message.isMine ? 'chat-bubble--mine' : 'chat-bubble--peer'}`}
            >
              <p className="chat-bubble__text">
                {showOriginal ? message.sourceText : message.displayText}
              </p>
              <div className="chat-bubble__meta">
                <span>{new Date(message.createdAt).toLocaleString()}</span>
                {!message.isMine && message.translationStatus !== 'none' ? (
                  <span>· {t(`translation.${message.translationStatus}`)}</span>
                ) : null}
              </div>
              {canToggleOriginal ? (
                <button
                  type="button"
                  className="chat-bubble__toggle"
                  onClick={() =>
                    setShowOriginalIds((current) => ({
                      ...current,
                      [message.id]: !current[message.id],
                    }))
                  }
                >
                  {showOriginal ? t('showTranslation') : t('showOriginal')}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        <label className="field">
          <span className="sr-only">{t('message')}</span>
          <textarea
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
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
