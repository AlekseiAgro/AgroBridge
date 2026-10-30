import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CABINET_SELLING_ROWS,
  cabinetStackRoute,
  languageSheetLocales,
  visibleCabinetTradeRows,
} from '../account/cabinet';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../auth/AuthProvider';
import { emailVerificationRoute } from '../auth/verify-email-form';
import { LOCALE_LABELS } from '../i18n/locales';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList, RootTabParamList } from '../navigation/types';
import { showMyProductsEntry } from '../seller/products';
import { useTheme } from '../theme/ThemeProvider';

export function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { status, user, profileUnavailable, logout } = useAuth();
  const { colors, spacing, borders } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const stack = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [loggingOut, setLoggingOut] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  const onLogout = () => {
    setLoggingOut(true);
    logout().finally(() => setLoggingOut(false));
  };

  const profileUser = status === 'authenticated' && !profileUnavailable && user ? user : null;
  const identity = profileUser?.displayName || profileUser?.email || '';
  const verified = profileUser != null && !emailVerificationRoute(profileUser);
  const myProductsVisible = showMyProductsEntry({
    authStatus: status === 'loading' ? 'loading' : status,
    profileUnavailable,
    emailVerified: user?.emailVerified === true,
  });

  const open = (row: Parameters<typeof cabinetStackRoute>[0]) => {
    stack?.navigate(cabinetStackRoute(row));
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="title" accessibilityRole="header">
            {t('account.title')}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('account.dualCapability')}
          </AppText>
        </View>

        {status === 'loading' ? (
          <Card padded>
            <View accessibilityRole="progressbar">
              <AppText tone="secondary">{t('account.loading')}</AppText>
            </View>
          </Card>
        ) : null}

        {status === 'anonymous' ? (
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText tone="secondary">{t('account.signedOut')}</AppText>
              <AppButton label={t('account.signIn')} onPress={() => stack?.navigate('Login')} />
            </View>
          </Card>
        ) : null}

        {status === 'authenticated' && profileUnavailable ? (
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText tone="secondary">{t('account.profileUnavailable')}</AppText>
              <AppButton label={t('account.logout')} onPress={onLogout} loading={loggingOut} variant="secondary" />
            </View>
          </Card>
        ) : null}

        {profileUser ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="brand">
              {t('account.profile')}
            </AppText>
            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderBottomWidth: borders.hairline,
                  borderBottomColor: colors.line,
                }}
              >
                <Avatar label={identity} accessibilityLabel={identity} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {identity}
                </AppText>
              </View>
              <FieldRow
                label={t('account.name')}
                value={profileUser.displayName || '—'}
                action={t('account.edit')}
                onPress={() => open('editName')}
              />
              <FieldRow label={t('auth.email')} value={profileUser.email} />
              <FieldRow
                label={t('auth.password')}
                value="••••••••"
                action={t('account.changePassword')}
                onPress={() => open('changePassword')}
                last
              />
            </Card>
            {emailVerificationRoute(profileUser) ? (
              <Card padded>
                <View style={{ gap: spacing.sm }}>
                  <AppText tone="secondary">{t('account.emailNotVerified')}</AppText>
                  <AppButton label={t('account.confirmEmail')} onPress={() => stack?.navigate('VerifyEmail')} />
                </View>
              </Card>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="brand">
            {t('account.languageTitle')}
          </AppText>
          <Card>
            <NavRow
              label={t('account.languageTitle')}
              value={LOCALE_LABELS[locale]}
              onPress={() => setLanguageOpen(true)}
              last
            />
          </Card>
        </View>

        {profileUser ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="brand">
              {t('account.purchases')}
            </AppText>
            <Card>
              {visibleCabinetTradeRows(verified).map((row, index, rows) => (
                <NavRow
                  key={row.id}
                  icon={tradeIcon(row.id)}
                  label={t(row.labelKey)}
                  onPress={() => open(row.id)}
                  last={index === rows.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null}

        {myProductsVisible ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="brand">
              {t('account.sellingTitle')}
            </AppText>
            <Card>
              {CABINET_SELLING_ROWS.map((row, index, rows) => (
                <NavRow
                  key={row.id}
                  icon={row.id === 'myProducts' ? 'leaf-outline' : 'business-outline'}
                  label={t(row.labelKey)}
                  onPress={() => open(row.id)}
                  last={index === rows.length - 1}
                />
              ))}
            </Card>
          </View>
        ) : null}

        {profileUser ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="label" tone="brand">
              {t('account.sessionTitle')}
            </AppText>
            <AppButton label={t('account.logout')} onPress={onLogout} loading={loggingOut} variant="secondary" />
          </View>
        ) : null}

        {verified ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => open('deleteAccount')}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <AppText variant="bodyStrong" tone="danger">
              {t('account.delete')}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={languageOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLanguageOpen(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}>
            <ScreenHeader
              title={t('account.languageTitle')}
              backLabel={t('common.back')}
              onBack={() => setLanguageOpen(false)}
            />
            <AppText variant="caption" tone="secondary">
              {t('account.languageHint')}
            </AppText>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
              {languageSheetLocales().map((code) => {
                const selected = locale === code;
                return (
                  <Pressable
                    key={code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t('a11y.selectLanguage', { language: LOCALE_LABELS[code] })}
                    onPress={() => {
                      setLocale(code);
                      setLanguageOpen(false);
                    }}
                    style={{
                      minHeight: 52,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      borderBottomWidth: borders.hairline,
                      borderBottomColor: colors.line,
                    }}
                  >
                    <AppText style={{ flex: 1 }} tone={selected ? 'brand' : 'ink'} variant={selected ? 'bodyStrong' : 'body'}>
                      {LOCALE_LABELS[code]}
                    </AppText>
                    {selected ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FieldRow({
  label,
  value,
  action,
  onPress,
  last = false,
}: {
  label: string;
  value: string;
  action?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const { colors, spacing, borders } = useTheme();
  return (
    <View
      style={{
        minHeight: 64,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: last ? 0 : borders.hairline,
        borderBottomColor: colors.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <AppText>{value}</AppText>
      </View>
      {action && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={{ flexShrink: 1, maxWidth: '46%' }}>
          <AppText variant="label" tone="brand" style={{ textAlign: 'right' }}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function tradeIcon(
  id: 'myRequests' | 'myQuotes' | 'myRfqs' | 'rfqInbox',
): keyof typeof Ionicons.glyphMap {
  switch (id) {
    case 'myRequests':
      return 'reader-outline';
    case 'myQuotes':
      return 'chatbubble-ellipses-outline';
    case 'myRfqs':
      return 'document-text-outline';
    case 'rfqInbox':
      return 'file-tray-outline';
  }
}

function NavRow({
  label,
  value,
  icon,
  onPress,
  last = false,
}: {
  label: string;
  value?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors, spacing, borders } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 52,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderBottomWidth: last ? 0 : borders.hairline,
        borderBottomColor: colors.line,
      }}
    >
      {icon ? <Ionicons name={icon} size={20} color={colors.brand} /> : null}
      <View style={{ flex: 1, flexShrink: 1, gap: 2 }}>
        <AppText style={{ flexShrink: 1 }}>{label}</AppText>
        {value ? (
          <AppText variant="caption" tone="secondary">
            {value}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
