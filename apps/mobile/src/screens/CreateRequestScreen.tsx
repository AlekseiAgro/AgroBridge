import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { failureMessageKey } from '../api/user-error';
import { useAuth } from '../auth/AuthProvider';
import { emailVerificationRoute } from '../auth/verify-email-form';
import { createPurchaseRequest } from '../catalog/api';
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '../catalog/categories';
import { categoryLabel, unitLabel } from '../catalog/labels';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Chip } from '../components/Chip';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { emptyRequestDraft, requestFieldError, requestPayload, type RequestDraft } from '../requests/form';
import { useTheme } from '../theme/ThemeProvider';

export function CreateRequestScreen() {
  const { t } = useI18n();
  const { colors, spacing, radii, borders, typography } = useTheme();
  const { api, status, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [draft, setDraft] = useState<RequestDraft>(emptyRequestDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (partial: Partial<RequestDraft>) => {
    setDraft((current) => ({ ...current, ...partial }));
    setError(null);
  };

  const submit = () => {
    const body = requestPayload(draft);
    if (!body) {
      if (requestFieldError(draft, 'title')) setError(t('requests.titleRequired'));
      else if (requestFieldError(draft, 'category')) setError(t('requests.categoryRequired'));
      else setError(t('requests.quantityRequired'));
      return;
    }
    setSaving(true);
    createPurchaseRequest(api, body)
      .then((created) => {
        if (created) {
          navigation.replace('RequestDetail', { requestId: created.id });
          return;
        }
        navigation.goBack();
      })
      .catch((error: unknown) => setError(t(failureMessageKey(error))))
      .finally(() => setSaving(false));
  };

  const fieldStyle = {
    minHeight: 44,
    borderWidth: borders.hairline,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  };

  if (status !== 'authenticated' || !user) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <ScreenHeader title={t('requests.create')} backLabel={t('common.back')} onBack={() => navigation.goBack()} />
          <AppText>{t('requests.signInBody')}</AppText>
          <AppButton label={t('account.signIn')} onPress={() => navigation.navigate('Login')} />
        </View>
      </SafeAreaView>
    );
  }

  if (emailVerificationRoute(user)) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <ScreenHeader title={t('requests.create')} backLabel={t('common.back')} onBack={() => navigation.goBack()} />
          <AppText>{t('account.emailNotVerified')}</AppText>
          <AppButton label={t('account.confirmEmail')} onPress={() => navigation.navigate('VerifyEmail')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.md,
        }}
      >
        <ScreenHeader title={t('requests.create')} backLabel={t('common.back')} onBack={() => navigation.goBack()} />
        <AppText variant="label">{t('requests.titleField')}</AppText>
        <TextInput
          value={draft.title}
          onChangeText={(title) => patch({ title })}
          accessibilityLabel={t('requests.titleField')}
          style={fieldStyle}
        />
        <AppText variant="label">{t('requests.category')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {PRODUCT_CATEGORIES.map((id) => (
            <Chip
              key={id}
              label={categoryLabel(id, t) ?? id}
              selected={draft.category === id}
              onPress={() => patch({ category: id })}
            />
          ))}
        </View>
        <AppText variant="label">{t('requests.quantity')}</AppText>
        <TextInput
          value={draft.quantity}
          onChangeText={(quantity) => patch({ quantity })}
          accessibilityLabel={t('requests.quantity')}
          style={fieldStyle}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {PRODUCT_UNITS.map((id) => (
            <Chip
              key={id}
              label={unitLabel(id, t) ?? id}
              selected={draft.unit === id}
              onPress={() => patch({ unit: draft.unit === id ? '' : id })}
            />
          ))}
        </View>
        <AppText variant="label">{t('requests.variety')}</AppText>
        <TextInput
          value={draft.variety}
          onChangeText={(variety) => patch({ variety })}
          accessibilityLabel={t('requests.variety')}
          style={fieldStyle}
        />
        <AppText variant="label">{t('requests.packaging')}</AppText>
        <TextInput
          value={draft.packaging}
          onChangeText={(packaging) => patch({ packaging })}
          accessibilityLabel={t('requests.packaging')}
          style={fieldStyle}
        />
        <AppText variant="label">{t('requests.destination')}</AppText>
        <TextInput
          value={draft.destinationCountry}
          onChangeText={(destinationCountry) => patch({ destinationCountry })}
          accessibilityLabel={t('requests.destination')}
          style={fieldStyle}
        />
        <AppText variant="label">{t('requests.message')}</AppText>
        <TextInput
          value={draft.message}
          onChangeText={(message) => patch({ message })}
          accessibilityLabel={t('requests.message')}
          multiline
          style={[fieldStyle, { minHeight: 96 }]}
        />
        {error ? <AppText tone="danger">{error}</AppText> : null}
        <AppButton label={t('requests.create')} onPress={submit} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}
