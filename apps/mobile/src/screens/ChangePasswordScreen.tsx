import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { changePasswordBody, passwordChangeIssue } from '../account/password';
import { failureMessageKey } from '../api/user-error';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

export function ChangePasswordScreen() {
  const { t } = useI18n();
  const { colors, spacing, radii, borders, typography } = useTheme();
  const { changePassword } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fieldStyle = {
    minHeight: 44,
    borderWidth: borders.hairline,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    ...typography.body,
  };

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
          title={t('account.changePassword')}
          backLabel={t('common.back')}
          onBack={() => navigation.goBack()}
        />
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            accessibilityLabel={t('account.currentPassword')}
            placeholder={t('account.currentPassword')}
            placeholderTextColor={colors.muted}
            style={fieldStyle}
          />
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            accessibilityLabel={t('account.newPassword')}
            placeholder={t('account.newPassword')}
            placeholderTextColor={colors.muted}
            style={fieldStyle}
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            accessibilityLabel={t('account.confirmNewPassword')}
            placeholder={t('account.confirmNewPassword')}
            placeholderTextColor={colors.muted}
            style={fieldStyle}
          />
          {message ? <AppText tone="secondary">{message}</AppText> : null}
          <AppButton
            label={t('account.changePassword')}
            loading={saving}
            onPress={() => {
              const issue = passwordChangeIssue(currentPassword, newPassword, confirmPassword);
              if (issue === 'short') {
                setMessage(t('auth.passwordTooShort'));
                return;
              }
              if (issue === 'mismatch') {
                setMessage(t('auth.passwordsDoNotMatch'));
                return;
              }
              if (issue === 'same') {
                setMessage(t('account.passwordSame'));
                return;
              }
              const body = changePasswordBody(currentPassword, newPassword, confirmPassword);
              if (!body) return;
              setSaving(true);
              setMessage(null);
              changePassword(body.currentPassword, body.newPassword)
                .then(() => {
                  Alert.alert(t('account.passwordChanged'));
                  navigation.goBack();
                })
                .catch((error: unknown) => setMessage(t(failureMessageKey(error, 'credentials'))))
                .finally(() => setSaving(false));
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
