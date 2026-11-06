import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import {
  initialPasswordVisible,
  passwordIsHidden,
  togglePasswordVisible,
} from '../auth/password-visibility';
import {
  FALLBACK_TERMS_VERSION,
  registrationCanOpenVerifyEmail,
  submitRegistration,
  termsVersionFromDocuments,
  type RegisterField,
  type RegisterFieldCode,
  type RegisterFieldErrors,
  type RegisterGate,
  type RegisterRole,
} from '../auth/register-form';
import { AppButton } from '../components/AppButton';
import { AppIconButton } from '../components/AppIconButton';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/en';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

const fieldMessageKey: Record<RegisterField, Partial<Record<RegisterFieldCode, MessageKey>>> = {
  email: {
    required: 'auth.emailRequired',
    invalid: 'auth.emailInvalid',
  },
  password: {
    required: 'auth.passwordRequired',
    tooShort: 'auth.passwordTooShort',
    tooLong: 'auth.passwordTooLong',
  },
  confirmPassword: {
    required: 'auth.confirmPasswordRequired',
    mismatch: 'auth.passwordsDoNotMatch',
  },
  displayName: {
    tooLong: 'auth.displayNameTooLong',
  },
  role: {
    required: 'auth.roleRequired',
  },
  terms: {
    required: 'auth.termsRequired',
  },
};

export function RegisterScreen() {
  const { t, locale } = useI18n();
  const { colors, spacing, radii, touchTarget } = useTheme();
  const { api, register } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gate = useRef<RegisterGate>({ pending: false });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(initialPasswordVisible);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(initialPasswordVisible);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<RegisterRole>('farmer');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsVersion, setTermsVersion] = useState(FALLBACK_TERMS_VERSION);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const legalLocale = locale === 'ka' ? 'ka' : 'en';
    api
      .request<unknown>(`/legal/documents/current?locale=${legalLocale}`, { auth: false })
      .then((body) => {
        if (!cancelled) {
          setTermsVersion(termsVersionFromDocuments(body));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTermsVersion(FALLBACK_TERMS_VERSION);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, locale]);

  const inputStyle = {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  };
  const secretInputStyle = {
    ...inputStyle,
    paddingRight: spacing.md + touchTarget,
  };

  const goToAccount = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { screen: 'Account' } }],
    });
  };

  const leave = () => {
    if (notice) {
      goToAccount();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main', { screen: 'Account' });
  };

  const onSubmit = async () => {
    const result = await submitRegistration({
      email,
      password,
      confirmPassword,
      displayName,
      role,
      acceptTerms,
      locale,
      acceptedTermsVersion: termsVersion,
      gate: gate.current,
      register: async (body) => {
        const created = await register(body);
        return {
          emailVerified: created.user.emailVerified,
          verificationEmailSent: created.verificationEmailSent,
        };
      },
      onPending: setPending,
    });
    if ('ignored' in result && result.ignored) {
      return;
    }
    setFieldErrors(result.fieldErrors);
    if (result.signedIn) {
      setFormError(null);
      if (registrationCanOpenVerifyEmail(result)) {
        setNotice(result.verificationEmailSent ? t('auth.registeredVerify') : t('auth.registeredEmailUnsent'));
        return;
      }
      goToAccount();
      return;
    }
    if (Object.keys(result.fieldErrors).length > 0) {
      setFormError(null);
      return;
    }
    setFormError(result.duplicateEmail ? t('auth.emailTaken') : (result.formError ?? t('auth.registerFailed')));
  };

  const messageFor = (field: RegisterField) => {
    const code = fieldErrors[field];
    const key = code ? fieldMessageKey[field][code] : undefined;
    return key ? t(key) : null;
  };

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
        <ScreenHeader title={t('auth.registerTitle')} backLabel={t('common.back')} onBack={leave} />
        {notice ? (
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText>{notice}</AppText>
              <AppButton
                label={t('auth.confirmEmail')}
                onPress={() => navigation.navigate('VerifyEmail')}
              />
              <AppButton label={t('auth.continue')} variant="secondary" onPress={goToAccount} />
            </View>
          </Card>
        ) : (
          <Card padded>
            <View style={{ gap: spacing.md }}>
              <AppText tone="secondary">{t('auth.roleHint')}</AppText>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="label">{t('auth.displayName')}</AppText>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCorrect={false}
                  autoComplete="name"
                  textContentType="name"
                  editable={!pending}
                  accessibilityLabel={t('auth.displayName')}
                  style={inputStyle}
                />
                {messageFor('displayName') ? (
                  <AppText tone="danger">{messageFor('displayName')}</AppText>
                ) : null}
              </View>
              <View style={{ gap: spacing.sm }}>
                <AppText variant="label">{t('auth.role')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  <Chip
                    label={t('auth.roleFarmer')}
                    selected={role === 'farmer'}
                    onPress={() => setRole('farmer')}
                  />
                  <Chip
                    label={t('auth.roleBuyer')}
                    selected={role === 'buyer'}
                    onPress={() => setRole('buyer')}
                  />
                </View>
                {messageFor('role') ? <AppText tone="danger">{messageFor('role')}</AppText> : null}
              </View>
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
                {messageFor('email') ? <AppText tone="danger">{messageFor('email')}</AppText> : null}
              </View>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="label">{t('auth.password')}</AppText>
                <View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={passwordIsHidden(passwordVisible)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!pending}
                    accessibilityLabel={t('auth.password')}
                    style={secretInputStyle}
                  />
                  <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' }}>
                    <AppIconButton
                      name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                      accessibilityLabel={
                        passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')
                      }
                      onPress={() => setPasswordVisible((visible) => togglePasswordVisible(visible))}
                    />
                  </View>
                </View>
                {messageFor('password') ? (
                  <AppText tone="danger">{messageFor('password')}</AppText>
                ) : null}
              </View>
              <View style={{ gap: spacing.xs }}>
                <AppText variant="label">{t('auth.confirmPassword')}</AppText>
                <View>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={passwordIsHidden(confirmPasswordVisible)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!pending}
                    accessibilityLabel={t('auth.confirmPassword')}
                    style={secretInputStyle}
                  />
                  <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' }}>
                    <AppIconButton
                      name={confirmPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      accessibilityLabel={
                        confirmPasswordVisible
                          ? t('auth.hideConfirmPassword')
                          : t('auth.showConfirmPassword')
                      }
                      onPress={() =>
                        setConfirmPasswordVisible((visible) => togglePasswordVisible(visible))
                      }
                    />
                  </View>
                </View>
                {messageFor('confirmPassword') ? (
                  <AppText tone="danger">{messageFor('confirmPassword')}</AppText>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptTerms, disabled: pending }}
                accessibilityLabel={t('auth.acceptTerms')}
                disabled={pending}
                onPress={() => setAcceptTerms((current) => !current)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: radii.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: acceptTerms ? colors.brandDeep : colors.surface,
                  }}
                >
                  {acceptTerms ? (
                    <AppText variant="caption" tone="inverse">
                      ✓
                    </AppText>
                  ) : null}
                </View>
                <AppText style={{ flex: 1 }}>{t('auth.acceptTerms')}</AppText>
              </Pressable>
              {messageFor('terms') ? <AppText tone="danger">{messageFor('terms')}</AppText> : null}
              {formError ? <AppText tone="danger">{formError}</AppText> : null}
              <AppButton
                label={pending ? t('auth.registering') : t('auth.registerSubmit')}
                onPress={() => {
                  void onSubmit();
                }}
                loading={pending}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
