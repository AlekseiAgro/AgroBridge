import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { failureMessageKey } from '../api/user-error';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../theme/ThemeProvider';
import { accountDeletionConfirmBody, accountDeletionRequestBody } from './delete-account';

export function DeleteAccountSection() {
  const { t } = useI18n();
  const { api, logout } = useAuth();
  const { colors, spacing, radii, borders, typography } = useTheme();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const sendCode = () => {
    const body = accountDeletionRequestBody(password);
    if (!body) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    setPending(true);
    setError(null);
    api
      .request('/cabinet/me/delete/request', { method: 'POST', body, preserveSessionOn401: true })
      .then(() => setSent(true))
      .catch((error: unknown) => setError(t(failureMessageKey(error, 'credentials'))))
      .finally(() => setPending(false));
  };

  const confirm = () => {
    const body = accountDeletionConfirmBody(password, code);
    if (!body) {
      setError(t('account.deleteFailed'));
      return;
    }
    Alert.alert(t('account.delete'), t('account.deleteConfirmBody'), [
      { text: t('common.back'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          setPending(true);
          setError(null);
          api
            .request('/cabinet/me/delete/confirm', {
              method: 'POST',
              body,
              preserveSessionOn401: true,
            })
            .then(() => logout())
            .catch((error: unknown) => {
              setError(t(failureMessageKey(error, 'deleteConfirm')));
              setPending(false);
            });
        },
      },
    ]);
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card padded style={{ backgroundColor: colors.dangerSoft }}>
        <View style={{ gap: spacing.md }}>
          <AppText>{t('account.deleteHint')}</AppText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            accessibilityLabel={t('account.deletePassword')}
            placeholder={t('account.deletePassword')}
            placeholderTextColor={colors.muted}
            style={fieldStyle}
          />
          {sent ? (
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              accessibilityLabel={t('account.deleteCode')}
              placeholder={t('account.deleteCode')}
              placeholderTextColor={colors.muted}
              style={fieldStyle}
            />
          ) : null}
          {error ? <AppText tone="danger">{error}</AppText> : null}
          {sent ? (
            <AppButton
              label={t('account.deleteConfirm')}
              onPress={confirm}
              loading={pending}
              style={{ backgroundColor: colors.danger, borderColor: colors.danger }}
            />
          ) : (
            <AppButton
              label={t('account.deleteSend')}
              onPress={sendCode}
              loading={pending}
              style={{ backgroundColor: colors.danger, borderColor: colors.danger }}
            />
          )}
        </View>
      </Card>
    </View>
  );
}
