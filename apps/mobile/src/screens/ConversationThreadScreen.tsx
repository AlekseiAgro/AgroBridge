import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../api/config';
import { resolveMediaUrl } from '../api/media-url';
import { useAuth } from '../auth/AuthProvider';
import { sendConversationMessage } from '../chat/api';
import {
  canSubmitComposer,
  composerAvailable,
  composerIssue,
  draftAfterSubmit,
  submitComposer,
  type ComposerGate,
  type ComposerIssue,
} from '../chat/composer';
import { conversationListPhase } from '../chat/list';
import { threadIsNearBottom } from '../chat/poll';
import {
  formatThreadDate,
  messageAlign,
  messageBody,
  messageSenderName,
  nextOriginalVisibility,
  threadRows,
  type ThreadRow,
} from '../chat/thread';
import type { ConversationMessage } from '../chat/model';
import { useConversationThread } from '../chat/use-conversation-thread';
import { AppButton } from '../components/AppButton';
import { AppIconButton } from '../components/AppIconButton';
import { AppText } from '../components/AppText';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

const deliveryKey: Record<Exclude<ConversationMessage['deliveryStatus'], null>, MessageKey> = {
  sent: 'messages.deliverySent',
  delivered: 'messages.deliveryDelivered',
  read: 'messages.deliveryRead',
};

function formatMessageTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ConversationThreadScreen() {
  const { t, locale } = useI18n();
  const { colors, spacing, radii } = useTheme();
  const { api } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ConversationThread'>>();
  const feed = useConversationThread(route.params.conversationId);
  const listRef = useRef<FlatList<ThreadRow>>(null);
  const stickToBottomRef = useRef(true);
  const gate = useRef<ComposerGate>({ pending: false });
  const [originalIds, setOriginalIds] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<ComposerIssue | null>(null);
  const [sendFailed, setSendFailed] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const phase = conversationListPhase({
    authStatus: feed.authStatus === 'loading' ? 'loading' : feed.authStatus,
    user: feed.user,
    profileUnavailable: feed.profileUnavailable,
    loadStatus: feed.loadStatus,
    count: feed.conversation?.messages.length ?? 0,
  });
  const rows = threadRows(feed.conversation?.messages ?? [], new Date());
  const peerName = feed.conversation?.peer.displayName?.trim() || t('messages.unknownPeer');
  const senderNames = {
    mineDisplayName: feed.user?.displayName,
    mineEmail: feed.user?.email,
    peerDisplayName: feed.conversation?.peer.displayName,
  };
  const avatarUrl = resolveMediaUrl(feed.conversation?.peer.avatarUrl, apiBaseUrlFromEnv());

  useEffect(() => {
    if (phase !== 'list' || rows.length === 0 || !stickToBottomRef.current) {
      return;
    }
    const handle = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(handle);
  }, [phase, rows.length]);

  const rememberStick = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    stickToBottomRef.current = threadIsNearBottom(
      contentOffset.y,
      layoutMeasurement.height,
      contentSize.height,
    );
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const showComposer = composerAvailable(phase);
  const visibleIssue = composerIssue(draft) === 'tooLong' ? 'tooLong' : issue;

  const onChangeDraft = (value: string) => {
    setDraft(value);
    setIssue(null);
    setSendFailed(false);
  };

  const onSend = async () => {
    const result = await submitComposer({
      text: draft,
      sourceLocale: locale,
      gate: gate.current,
      send: (body) => sendConversationMessage(api, route.params.conversationId, body),
      onPending: setPending,
    });
    if (result.status === 'ignored') {
      return;
    }
    if (result.status === 'invalid') {
      setIssue(result.issue);
      setSendFailed(false);
      return;
    }
    if (result.status === 'failed') {
      setSendFailed(true);
      setIssue(null);
      return;
    }
    setDraft((current) => draftAfterSubmit(current, result.sentText, true));
    setIssue(null);
    setSendFailed(false);
    stickToBottomRef.current = true;
    feed.appendMessage(result.message);
  };

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main', { screen: 'Messages' });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
        }}
      >
        <AppIconButton name="chevron-back" accessibilityLabel={t('common.back')} onPress={leave} />
        {feed.conversation ? (
          <Avatar label={peerName} imageUrl={avatarUrl} accessibilityLabel={peerName} />
        ) : null}
        <AppText variant="title" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
          {feed.conversation ? peerName : t('messages.threadLoading')}
        </AppText>
      </View>

      <View style={{ flex: 1, paddingBottom: showComposer ? 0 : insets.bottom }}>
      {phase === 'session' || phase === 'loading' ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <LoadingSkeleton accessibilityLabel={t('messages.threadLoading')} />
        </View>
      ) : null}
      {phase === 'signedOut' ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText tone="secondary">{t('account.signedOut')}</AppText>
              <AppButton label={t('account.signIn')} onPress={() => navigation.navigate('Login')} />
            </View>
          </Card>
        </View>
      ) : null}
      {phase === 'unverified' ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText tone="secondary">{t('account.emailNotVerified')}</AppText>
              <AppButton
                label={t('account.confirmEmail')}
                onPress={() => navigation.navigate('VerifyEmail')}
              />
            </View>
          </Card>
        </View>
      ) : null}
      {phase === 'profileUnavailable' ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <AppText tone="secondary">{t('account.profileUnavailable')}</AppText>
        </View>
      ) : null}
      {phase === 'error' ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <ErrorState
            title={t('messages.threadLoadErrorTitle')}
            body={t('messages.threadLoadErrorBody')}
            retryLabel={t('messages.retry')}
            onRetry={feed.reload}
          />
        </View>
      ) : null}
      {phase === 'empty' ? (
        <EmptyState title={t('messages.threadEmptyTitle')} body={t('messages.threadEmptyBody')} />
      ) : null}
      {phase === 'list' ? (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(item) => (item.type === 'date' ? item.id : item.message.id)}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            gap: spacing.sm,
          }}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          onScrollEndDrag={rememberStick}
          onMomentumScrollEnd={rememberStick}
          onContentSizeChange={() => {
            if (stickToBottomRef.current) {
              listRef.current?.scrollToEnd({ animated: false });
            }
          }}
          renderItem={({ item }) => {
            if (item.type === 'date') {
              const label =
                item.kind === 'today'
                  ? t('messages.dateToday')
                  : item.kind === 'yesterday'
                    ? t('messages.dateYesterday')
                    : formatThreadDate(item.createdAt, locale);
              return (
                <View style={{ alignItems: 'center', marginVertical: spacing.sm }}>
                  <View
                    style={{
                      backgroundColor: colors.neutralSoft,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <AppText variant="caption" tone="secondary">
                      {label}
                    </AppText>
                  </View>
                </View>
              );
            }
            const message = item.message;
            const mine = messageAlign(message) === 'mine';
            const showingOriginal = originalIds.has(message.id);
            const time = formatMessageTime(message.createdAt, locale);
            const sender = messageSenderName(mine, senderNames, t('messages.unknownPeer'));
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={{ maxWidth: '80%', gap: spacing.xs }}>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {sender}
                  </AppText>
                  <View
                  style={{
                    backgroundColor: mine ? colors.brandSoft : colors.surface,
                    borderRadius: radii.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    gap: spacing.xs,
                  }}
                >
                  <AppText>{messageBody(message, showingOriginal)}</AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
                    {time ? (
                      <AppText variant="caption" tone="muted">
                        {time}
                      </AppText>
                    ) : null}
                    {mine && message.deliveryStatus ? (
                      <AppText variant="caption" tone="muted">
                        {t(deliveryKey[message.deliveryStatus])}
                      </AppText>
                    ) : null}
                  </View>
                  {message.canShowOriginal ? (
                    <AppButton
                      label={showingOriginal ? t('messages.showTranslation') : t('messages.showOriginal')}
                      variant="ghost"
                      onPress={() => {
                        setOriginalIds((current) =>
                          nextOriginalVisibility(current, message.id, message.canShowOriginal),
                        );
                      }}
                    />
                  ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />
      ) : null}
      </View>
      {showComposer ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: keyboardOpen ? spacing.sm : Math.max(insets.bottom, spacing.sm),
            gap: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <TextInput
              value={draft}
              onChangeText={onChangeDraft}
              multiline
              placeholder={t('messages.composerPlaceholder')}
              placeholderTextColor={colors.muted}
              accessibilityLabel={t('messages.composerPlaceholder')}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: radii.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                color: colors.ink,
                textAlignVertical: 'top',
              }}
            />
            <AppButton
              label={pending ? t('messages.sending') : t('messages.send')}
              loading={pending}
              disabled={!canSubmitComposer(draft, pending)}
              onPress={() => {
                void onSend();
              }}
            />
          </View>
          {visibleIssue === 'empty' ? (
            <AppText variant="caption" tone="danger">
              {t('messages.composerEmpty')}
            </AppText>
          ) : null}
          {visibleIssue === 'tooLong' ? (
            <AppText variant="caption" tone="danger">
              {t('messages.composerTooLong')}
            </AppText>
          ) : null}
          {sendFailed ? (
            <AppText variant="caption" tone="danger">
              {t('messages.sendError')}
            </AppText>
          ) : null}
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
