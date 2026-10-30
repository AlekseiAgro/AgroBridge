import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import {
  digitsOnlyCode,
  submitEmailConfirmation,
  submitEmailResend,
  type CodeFieldCode,
  type VerifyGate,
} from '../auth/verify-email-form';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

const fieldMessageKey: Record<CodeFieldCode, MessageKey> = {
  required: 'auth.verifyCodeRequired',
  invalid: 'auth.verifyCodeInvalid',
  incomplete: 'auth.verifyCodeIncomplete',
};

export function VerifyEmailScreen() {
  const { t } = useI18n();
  const { colors, spacing, radii } = useTheme();
  const { status, user, confirmEmail, sendEmailCode, refreshUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gate = useRef<VerifyGate>({ pending: false });
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<'confirm' | 'resend' | null>(null);
  const [fieldError, setFieldError] = useState<CodeFieldCode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const refreshed = useRef(false);

  useEffect(() => {
    if (refreshed.current) {
      return;
    }
    refreshed.current = true;
    refreshUser().catch(() => undefined);
  }, [refreshUser]);

  const inputStyle = {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    letterSpacing: 4,
  };

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main', { screen: 'Account' });
  };

  const onConfirm = async () => {
    setPendingAction('confirm');
    const result = await submitEmailConfirmation({
      code,
      gate: gate.current,
      confirm: confirmEmail,
      onPending: setPending,
    });
    setPendingAction(null);
    if ('ignored' in result && result.ignored) {
      return;
    }
    setFieldError(result.fieldError);
    if (result.confirmed) {
      setFormError(null);
      setSentMessage(null);
      setJustConfirmed(true);
      setCode('');
      return;
    }
    if (result.fieldError) {
      setFormError(null);
      return;
    }
    setFormError(result.formError ?? t('auth.verifyFailed'));
  };

  const onResend = async () => {
    setPendingAction('resend');
    const result = await submitEmailResend({
      gate: gate.current,
      send: sendEmailCode,
      onPending: setPending,
    });
    setPendingAction(null);
    if ('ignored' in result && result.ignored) {
      return;
    }
    if (result.sent && result.destination) {
      setFormError(null);
      setFieldError(null);
      setSentMessage(t('auth.verifySent', { destination: result.destination }));
      return;
    }
    setSentMessage(null);
    setFormError(result.formError ?? t('auth.verifyFailed'));
  };

  const showVerified = Boolean(user?.emailVerified) || justConfirmed;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader title={t('auth.verifyTitle')} backLabel={t('common.back')} onBack={leave} />
        <Card padded>
          {status === 'loading' ? (
            <AppText tone="secondary">{t('account.loading')}</AppText>
          ) : null}
          {status !== 'loading' && !user ? (
            <View style={{ gap: spacing.md }}>
              <AppText>{t('auth.verifyNeedSignIn')}</AppText>
              <AppButton label={t('common.back')} variant="secondary" onPress={leave} />
            </View>
          ) : null}
          {user && showVerified ? (
            <View style={{ gap: spacing.md }}>
              <AppText>{justConfirmed ? t('auth.verifyConfirmed') : t('auth.verifyAlready')}</AppText>
              <AppText tone="secondary">{user.email}</AppText>
              <AppButton label={t('auth.continue')} onPress={leave} />
            </View>
          ) : null}
          {user && !showVerified ? (
            <View style={{ gap: spacing.md }}>
              <AppText>{t('auth.verifyBody', { email: user.email })}</AppText>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="label">{t('auth.verifyCode')}</AppText>
                <TextInput
                  value={code}
                  onChangeText={(value) => {
                    setCode(digitsOnlyCode(value));
                    setFieldError(null);
                  }}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  editable={!pending}
                  accessibilityLabel={t('auth.verifyCode')}
                  style={inputStyle}
                />
                {fieldError ? <AppText tone="danger">{t(fieldMessageKey[fieldError])}</AppText> : null}
              </View>
              {formError ? <AppText tone="danger">{formError}</AppText> : null}
              {sentMessage ? <AppText tone="secondary">{sentMessage}</AppText> : null}
              <AppButton
                label={pendingAction === 'confirm' ? t('auth.verifyConfirming') : t('auth.verifyConfirm')}
                onPress={() => {
                  void onConfirm();
                }}
                loading={pendingAction === 'confirm'}
                disabled={code.length !== 6 || pending}
              />
              <AppButton
                label={pendingAction === 'resend' ? t('auth.verifyResending') : t('auth.verifyResend')}
                variant="secondary"
                onPress={() => {
                  void onResend();
                }}
                loading={pendingAction === 'resend'}
                disabled={pending}
              />
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
