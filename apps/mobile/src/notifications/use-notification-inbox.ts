import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  applyNotificationRead,
  claimMarkAll,
  claimMarkRead,
  commitMarkAll,
  hasUnreadNotifications,
  shouldLoadNotifications,
  unreadCountAfterRead,
  type AppNotification,
} from './inbox';
import { getUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from './inbox-api';

export function useNotificationInbox() {
  const { api, status, user, profileUnavailable } = useAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionError, setActionError] = useState<'read' | 'readAll' | null>(null);
  const [pendingReadIds, setPendingReadIds] = useState<string[]>([]);
  const [markingAll, setMarkingAll] = useState(false);
  const hasLoadedRef = useRef(false);
  const pendingRef = useRef<string[]>([]);
  const markingAllRef = useRef(false);
  const canLoad = shouldLoadNotifications(user);

  useFocusEffect(
    useCallback(() => {
      if (!canLoad) {
        setItems([]);
        setUnreadCount(0);
        setLoadStatus('idle');
        setRefreshing(false);
        hasLoadedRef.current = false;
        return;
      }
      let cancelled = false;
      const request = reloadToken;
      const initial = !hasLoadedRef.current;
      if (initial) {
        setLoadStatus('loading');
      } else {
        setRefreshing(true);
      }
      Promise.all([listNotifications(api), getUnreadCount(api)])
        .then(([nextItems, count]) => {
          if (!cancelled && request === reloadToken) {
            setItems(nextItems);
            setUnreadCount(count);
            hasLoadedRef.current = true;
            setLoadStatus('ready');
            setActionError(null);
          }
        })
        .catch(() => {
          if (!cancelled && request === reloadToken && !hasLoadedRef.current) {
            setLoadStatus('error');
          }
        })
        .finally(() => {
          if (!cancelled && request === reloadToken) {
            setRefreshing(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [api, canLoad, reloadToken]),
  );

  const markRead = useCallback(
    async (item: AppNotification): Promise<boolean> => {
      const nextPending = claimMarkRead(pendingRef.current, item.id, item.readAt);
      if (!nextPending || markingAllRef.current) {
        return false;
      }
      pendingRef.current = nextPending;
      setPendingReadIds(nextPending);
      try {
        const updated = await markNotificationRead(api, item.id);
        setItems((current) => applyNotificationRead(current, updated));
        setUnreadCount((count) => unreadCountAfterRead(count, true));
        setActionError(null);
        return true;
      } catch {
        setActionError('read');
        return false;
      } finally {
        const remaining = pendingRef.current.filter((id) => id !== item.id);
        pendingRef.current = remaining;
        setPendingReadIds(remaining);
      }
    },
    [api],
  );

  const markAllRead = useCallback(async (): Promise<boolean> => {
    if (!claimMarkAll(markingAllRef.current, hasUnreadNotifications(items, unreadCount))) {
      return false;
    }
    markingAllRef.current = true;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(api);
      const readAt = new Date().toISOString();
      setItems((current) => commitMarkAll(current, true, readAt));
      setUnreadCount(0);
      setActionError(null);
      return true;
    } catch {
      setActionError('readAll');
      return false;
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
    }
  }, [api, items, unreadCount]);

  return {
    authStatus: status,
    user,
    profileUnavailable,
    loadStatus,
    refreshing,
    items,
    unreadCount,
    actionError,
    pendingReadIds,
    markingAll,
    canMarkAll: hasUnreadNotifications(items, unreadCount),
    reload: () => setReloadToken((current) => current + 1),
    markRead,
    markAllRead,
  };
}
