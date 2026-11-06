import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import {
  submitLogin,
  type LoginField,
  type LoginFieldCode,
  type LoginFieldErrors,
  type LoginGate,
} from '../auth/login-form';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

const fieldMessageKey: Record<LoginField, Record<LoginFieldCode, MessageKey>> = {
  email: {
    required: 'auth.emailRequired',
    invalid: 'auth.emailInvalid',
    tooShort: 'auth.emailInvalid',
    tooLong: 'auth.emailInvalid',
  },
  password: {
    required: 'auth.passwordRequired',
    invalid: 'auth.passwordRequired',
    tooShort: 'auth.passwordTooShort',
    tooLong: 'auth.passwordTooLong',
  },
};

export function LoginScreen() {
  const { t } = useI18n();
  const { colors, spacing, radii } = useTheme();
  const { login } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gate = useRef<LoginGate>({ pending: false });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const inputStyle = {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  };

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main', { screen: 'Account' });
  };

  const onSubmit = async () => {
    const result = await submitLogin({
      email,
      password,
      gate: gate.current,
      login,
      onPending: setPending,
    });
    if ('ignored' in result && result.ignored) {
      return;
    }
    setFieldErrors(result.fieldErrors);
    if (result.signedIn) {
      setFormError(null);
      leave();
      return;
    }
    if (result.fieldErrors.email || result.fieldErrors.password) {
      setFormError(null);
      return;
    }
    setFormError(result.formError ?? t('auth.failed'));
  };

  const emailError = fieldErrors.email ? t(fieldMessageKey.email[fieldErrors.email]) : null;
  const passwordError = fieldErrors.password
    ? t(fieldMessageKey.password[fieldErrors.password])
    : null;

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
        <ScreenHeader title={t('auth.title')} backLabel={t('common.back')} onBack={leave} />
        <Card padded>
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">{t('auth.email')}</AppText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                inputMode="email"
                editable={!pending}
                accessibilityLabel={t('auth.email')}
                style={inputStyle}
              />
              {emailError ? <AppText tone="danger">{emailError}</AppText> : null}
            </View>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">{t('auth.password')}</AppText>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                editable={!pending}
                accessibilityLabel={t('auth.password')}
                style={inputStyle}
              />
              {passwordError ? <AppText tone="danger">{passwordError}</AppText> : null}
            </View>
            {formError ? <AppText tone="danger">{formError}</AppText> : null}
            <AppButton
              label={pending ? t('auth.signingIn') : t('auth.submit')}
              onPress={() => {
                void onSubmit();
              }}
              loading={pending}
            />
            <AppButton
              label={t('auth.createAccount')}
              variant="secondary"
              disabled={pending}
              onPress={() => navigation.navigate('Register')}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
