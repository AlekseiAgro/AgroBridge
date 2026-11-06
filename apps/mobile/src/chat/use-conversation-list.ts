import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { listConversations } from './api';
import { shouldLoadConversations } from './list';
import type { ConversationSummary } from './model';

export function useConversationList() {
  const { api, status, user, profileUnavailable } = useAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const canLoad = shouldLoadConversations(user);

  useFocusEffect(
    useCallback(() => {
      if (!canLoad) {
        setConversations([]);
        setLoadStatus('idle');
        return;
      }
      let cancelled = false;
      const request = reloadToken;
      setLoadStatus('loading');
      listConversations(api)
        .then((items) => {
          if (!cancelled && request === reloadToken) {
            setConversations(items);
            setLoadStatus('ready');
          }
        })
        .catch(() => {
          if (!cancelled && request === reloadToken) {
            setLoadStatus('error');
          }
        });
      return () => {
        cancelled = true;
      };
    }, [api, canLoad, reloadToken]),
  );

  return {
    authStatus: status,
    user,
    profileUnavailable,
    loadStatus,
    conversations,
    reload: () => setReloadToken((current) => current + 1),
  };
}
