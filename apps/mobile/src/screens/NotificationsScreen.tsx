import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { SectionHeader } from '../components/SectionHeader';
import { useI18n } from '../i18n/I18nProvider';
import {
  compactUnreadBadge,
  formatNotificationTime,
  notificationCenterPhase,
  planNotificationOpen,
  shouldShowMarkAll,
  type NotificationDestination,
} from '../notifications/inbox';
import { useNotificationInbox } from '../notifications/use-notification-inbox';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

function openNotificationDestination(
  stack: NativeStackNavigationProp<RootStackParamList>,
  destination: NotificationDestination,
) {
  switch (destination.screen) {
    case 'ProductDetail':
      stack.navigate('ProductDetail', destination.params);
      return;
    case 'EditProduct':
      stack.navigate('EditProduct', destination.params);
      return;
    case 'RequestDetail':
      stack.navigate('RequestDetail', destination.params);
      return;
    case 'FarmDetail':
      stack.navigate('FarmDetail', destination.params);
      return;
    case 'ConversationThread':
      stack.navigate('ConversationThread', destination.params);
      return;
    case 'FarmProfile':
      stack.navigate('FarmProfile');
      return;
    case 'MyQuotes':
      stack.navigate('MyQuotes');
      return;
    case 'MyRequests':
      stack.navigate('MyRequests');
      return;
    case 'RfqDetail':
      stack.navigate('RfqDetail', destination.params);
      return;
    case 'RfqInbox':
      stack.navigate('RfqInbox');
      return;
    default:
      return;
  }
}

export function NotificationsScreen() {
  const { t, locale } = useI18n();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const stack = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const feed = useNotificationInbox();
  const phase = notificationCenterPhase({
    authStatus: feed.authStatus === 'loading' ? 'loading' : feed.authStatus,
    user: feed.user,
    profileUnavailable: feed.profileUnavailable,
    loadStatus: feed.loadStatus,
    count: feed.items.length,
  });
  const badge = compactUnreadBadge(feed.unreadCount);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarBadge: badge ?? undefined });
    }, [badge, navigation]),
  );

  const openNotification = (id: string) => {
    const item = feed.items.find((entry) => entry.id === id);
    const plan = planNotificationOpen({
      item,
      pending: feed.pendingReadIds.includes(id),
      markingAll: feed.markingAll,
    });
    if (!plan) {
      return;
    }
    const go = () => {
      if (plan.destination && stack) {
        openNotificationDestination(stack, plan.destination);
      }
    };
    if (!plan.markRead || !item) {
      go();
      return;
    }
    void feed.markRead(item).then((accepted) => {
      if (accepted) {
        go();
      }
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          phase === 'list' || phase === 'empty' ? (
            <RefreshControl
              refreshing={feed.refreshing}
              onRefresh={feed.reload}
              tintColor={colors.brand}
            />
          ) : undefined
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        <SectionHeader title={t('notifications.title')} />
        {shouldShowMarkAll(phase, feed.canMarkAll) ? (
          <AppButton
            label={t('notifications.markAllRead')}
            variant="ghost"
            loading={feed.markingAll}
            onPress={() => {
              void feed.markAllRead();
            }}
          />
        ) : null}
        {feed.actionError === 'read' ? (
          <AppText tone="danger">{t('notifications.markReadError')}</AppText>
        ) : null}
        {feed.actionError === 'readAll' ? (
          <AppText tone="danger">{t('notifications.markAllError')}</AppText>
        ) : null}
        {phase === 'session' || phase === 'loading' ? (
          <LoadingSkeleton accessibilityLabel={t('notifications.loading')} />
        ) : null}
        {phase === 'signedOut' ? (
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText tone="secondary">{t('account.signedOut')}</AppText>
              <AppButton label={t('account.signIn')} onPress={() => stack?.navigate('Login')} />
            </View>
          </Card>
        ) : null}
        {phase === 'unverified' ? (
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText tone="secondary">{t('account.emailNotVerified')}</AppText>
              <AppButton label={t('account.confirmEmail')} onPress={() => stack?.navigate('VerifyEmail')} />
            </View>
          </Card>
        ) : null}
        {phase === 'profileUnavailable' ? (
          <AppText tone="secondary">{t('account.profileUnavailable')}</AppText>
        ) : null}
        {phase === 'error' ? (
          <ErrorState
            title={t('notifications.loadErrorTitle')}
            body={t('notifications.loadErrorBody')}
            retryLabel={t('notifications.retry')}
            onRetry={feed.reload}
          />
        ) : null}
        {phase === 'empty' ? (
          <EmptyState
            title={t('notifications.emptyTitle')}
            body={t('notifications.emptyBody')}
            actionLabel={t('notifications.goHome')}
            onAction={() => navigation.navigate('Home')}
          />
        ) : null}
        {phase === 'list'
          ? feed.items.map((item) => {
              const unread = !item.readAt;
              const when = formatNotificationTime(item.createdAt, locale, {
                yesterday: t('messages.dateYesterday'),
              });
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    unread ? `${item.title}. ${t('notifications.unread', { count: 1 })}` : item.title
                  }
                  accessibilityState={{ busy: feed.pendingReadIds.includes(item.id) }}
                  onPress={() => openNotification(item.id)}
                >
                  <Card
                    padded
                    style={
                      unread
                        ? { borderLeftWidth: 3, borderLeftColor: colors.brand, backgroundColor: colors.brandSoft }
                        : undefined
                    }
                  >
                    <View style={{ gap: spacing.xs }}>
                      <AppText variant={unread ? 'bodyStrong' : 'body'}>{item.title}</AppText>
                      {item.body ? <AppText tone="secondary">{item.body}</AppText> : null}
                      {when ? (
                        <AppText variant="caption" tone="muted">
                          {when}
                        </AppText>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
