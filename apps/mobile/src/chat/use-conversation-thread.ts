import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { getConversation } from './api';
import { appendSentMessage } from './composer';
import {
  applyConversationPoll,
  createThreadPoller,
  loadOpenThread,
  nextThreadLoadStatus,
  shouldShowThreadLoading,
  threadPollingEnabled,
} from './poll';
import type { ConversationDetail, ConversationMessage } from './model';

export function useConversationThread(conversationId: string) {
  const { api, status, user, profileUnavailable } = useAuth();
  const { locale } = useI18n();
  const [reloadToken, setReloadToken] = useState(0);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const canLoad = threadPollingEnabled(user);
  const hasLoadedRef = useRef<{ id: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!canLoad) {
        hasLoadedRef.current = null;
        setConversation(null);
        setLoadStatus('idle');
        return;
      }
      let cancelled = false;
      const request = reloadToken;
      const poller = createThreadPoller({
        enabled: true,
        refresh: (mode) => {
          const hasLoaded = hasLoadedRef.current?.id === conversationId;
          if (shouldShowThreadLoading(mode, hasLoaded)) {
            setLoadStatus('loading');
          }
          return loadOpenThread(
            (id, currentLocale) => getConversation(api, id, currentLocale),
            conversationId,
            locale,
          )
            .then((detail) => {
              if (cancelled || request !== reloadToken) {
                return;
              }
              hasLoadedRef.current = { id: conversationId };
              setConversation((current) => applyConversationPoll(current, detail));
              setLoadStatus('ready');
            })
            .catch(() => {
              if (cancelled || request !== reloadToken) {
                return;
              }
              setLoadStatus((current) =>
                nextThreadLoadStatus({
                  mode,
                  hasLoaded: hasLoadedRef.current?.id === conversationId,
                  failed: true,
                  current,
                }),
              );
            });
        },
      });
      return () => {
        cancelled = true;
        poller.stop();
      };
    }, [api, canLoad, conversationId, locale, reloadToken]),
  );

  const appendMessage = useCallback((message: ConversationMessage) => {
    setConversation((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        messages: appendSentMessage(current.messages, message),
        lastMessage: message,
      };
    });
  }, []);

  return {
    authStatus: status,
    user,
    profileUnavailable,
    loadStatus,
    conversation,
    reload: () => setReloadToken((current) => current + 1),
    appendMessage,
  };
}
