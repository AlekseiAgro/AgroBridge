import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { failureMessageKey } from '../api/user-error';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

export function EditDisplayNameScreen() {
  const { t } = useI18n();
  const { colors, spacing, radii, borders, typography } = useTheme();
  const { api, user, refreshUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader
          title={t('account.displayName')}
          backLabel={t('common.back')}
          onBack={() => navigation.goBack()}
        />
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">{t('account.name')}</AppText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            accessibilityLabel={t('account.displayName')}
            placeholder={t('account.displayName')}
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 44,
              borderWidth: borders.hairline,
              borderColor: colors.line,
              borderRadius: radii.md,
              backgroundColor: colors.surface,
              color: colors.ink,
              paddingHorizontal: spacing.md,
              ...typography.body,
            }}
          />
          {message ? <AppText tone="secondary">{message}</AppText> : null}
          <AppButton
            label={t('account.saveProfile')}
            loading={saving}
            onPress={() => {
              setSaving(true);
              setMessage(null);
              api
                .request('/cabinet/me/profile', {
                  method: 'PATCH',
                  body: { displayName: displayName.trim() },
                })
                .then(() => refreshUser())
                .then(() => navigation.goBack())
                .catch((error: unknown) => setMessage(t(failureMessageKey(error))))
                .finally(() => setSaving(false));
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
