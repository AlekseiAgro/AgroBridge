import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { SectionHeader } from '../components/SectionHeader';
import { useAuth } from '../auth/AuthProvider';
import { APP_LOCALES, LOCALE_LABELS } from '../i18n/locales';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';

export function AccountScreen() {
  const { t, locale, setLocale } = useI18n();
  const { status, user, profileUnavailable, logout } = useAuth();
  const { colors, spacing } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = () => {
    setLoggingOut(true);
    logout().finally(() => setLoggingOut(false));
  };

  const identity = user?.displayName || user?.email || '';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.xl,
        }}
      >
        <SectionHeader title={t('account.title')} />

        <Card padded>
          <AppText tone="secondary">{t('account.dualCapability')}</AppText>
        </Card>

        <View style={{ gap: spacing.md }}>
          <AppText variant="title" accessibilityRole="header">
            {t('account.sessionTitle')}
          </AppText>
          <Card padded>
            {status === 'loading' ? (
              <View accessibilityRole="progressbar">
                <AppText tone="secondary">{t('account.loading')}</AppText>
              </View>
            ) : null}
            {status === 'anonymous' ? (
              <AppText tone="secondary">{t('account.signedOut')}</AppText>
            ) : null}
            {status === 'authenticated' && profileUnavailable ? (
              <View style={{ gap: spacing.md }}>
                <AppText tone="secondary">{t('account.profileUnavailable')}</AppText>
                <AppButton
                  label={t('account.logout')}
                  onPress={onLogout}
                  loading={loggingOut}
                  variant="secondary"
                />
              </View>
            ) : null}
            {status === 'authenticated' && !profileUnavailable && user ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Avatar label={identity} accessibilityLabel={identity} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{user.displayName || user.email}</AppText>
                    {user.displayName ? (
                      <AppText variant="caption" tone="secondary">
                        {user.email}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" tone="muted">
                      {t('account.signedIn')}
                    </AppText>
                  </View>
                </View>
                <AppButton
                  label={t('account.logout')}
                  onPress={onLogout}
                  loading={loggingOut}
                  variant="secondary"
                />
              </View>
            ) : null}
          </Card>
        </View>

        <View style={{ gap: spacing.md }}>
          <AppText variant="title" accessibilityRole="header">
            {t('account.languageTitle')}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('account.languageHint')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {APP_LOCALES.map((code) => (
              <Chip
                key={code}
                label={LOCALE_LABELS[code]}
                selected={locale === code}
                accessibilityLabel={t('a11y.selectLanguage', { language: LOCALE_LABELS[code] })}
                onPress={() => setLocale(code)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
