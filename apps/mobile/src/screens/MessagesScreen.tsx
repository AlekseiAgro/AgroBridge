import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../api/config';
import { resolveMediaUrl } from '../api/media-url';
import { conversationListPhase, toConversationRow } from '../chat/list';
import { conversationThreadParams } from '../chat/thread';
import { useConversationList } from '../chat/use-conversation-list';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { SectionHeader } from '../components/SectionHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

function formatActivity(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' }).format(date);
}

export function MessagesScreen() {
  const { t, locale } = useI18n();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const stack = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const feed = useConversationList();
  const phase = conversationListPhase({
    authStatus: feed.authStatus === 'loading' ? 'loading' : feed.authStatus,
    user: feed.user,
    profileUnavailable: feed.profileUnavailable,
    loadStatus: feed.loadStatus,
    count: feed.conversations.length,
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        <SectionHeader title={t('messages.title')} />
        {phase === 'session' || phase === 'loading' ? (
          <LoadingSkeleton accessibilityLabel={t('messages.loading')} />
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
            title={t('messages.loadErrorTitle')}
            body={t('messages.loadErrorBody')}
            retryLabel={t('messages.retry')}
            onRetry={feed.reload}
          />
        ) : null}
        {phase === 'empty' ? (
          <EmptyState
            title={t('messages.emptyTitle')}
            body={t('messages.emptyBody')}
            actionLabel={t('messages.goHome')}
            onAction={() => navigation.navigate('Home')}
          />
        ) : null}
        {phase === 'list'
          ? feed.conversations.map((conversation) => {
              const row = toConversationRow(conversation, {
                unknownPeer: t('messages.unknownPeer'),
                noPreview: t('messages.noPreview'),
              });
              const activity = formatActivity(row.activityAt, locale);
              const avatarUrl = resolveMediaUrl(row.avatarUrl, apiBaseUrlFromEnv());
              const thread = conversationThreadParams(row.id);
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.openConversation', { name: row.name })}
                  onPress={() => stack?.navigate(thread.screen, thread.params)}
                >
                  <Card padded>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <Avatar label={row.name} imageUrl={avatarUrl} accessibilityLabel={row.name} />
                      <View style={{ flex: 1, gap: spacing.xs }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {row.name}
                        </AppText>
                        <AppText variant="caption" tone="secondary" numberOfLines={1}>
                          {row.preview}
                        </AppText>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                        {activity ? (
                          <AppText variant="caption" tone="muted">
                            {activity}
                          </AppText>
                        ) : null}
                        {row.unreadCount > 0 ? (
                          <View accessibilityLabel={t('messages.unread', { count: row.unreadCount })}>
                            <Badge label={String(row.unreadCount)} tone="success" />
                          </View>
                        ) : null}
                      </View>
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
