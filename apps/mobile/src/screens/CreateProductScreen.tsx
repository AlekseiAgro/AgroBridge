import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SellerProductCertificates } from '../components/SellerProductCertificates';
import { SellerProductForm } from '../components/SellerProductForm';
import { SellerProductPhotos } from '../components/SellerProductPhotos';
import { SellerProductVideoSection } from '../components/SellerProductVideo';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import {
  createDraftPhase,
  editorAfterDraft,
  submitProductDraft,
  type DraftFailure,
  type DraftGate,
  type DraftIssue,
} from '../seller/draft';
import { EMPTY_PRODUCT_FORM, type SellerProductFormValues } from '../seller/product-form';
import { createProductDraft } from '../seller/products-api';
import { useTheme } from '../theme/ThemeProvider';

const ISSUE_KEY: Record<DraftIssue, MessageKey> = {
  titleRequired: 'seller.draft.titleRequired',
  titleTooShort: 'seller.draft.titleTooShort',
  titleTooLong: 'seller.draft.titleTooLong',
  descriptionTooLong: 'seller.draft.descriptionTooLong',
  varietyTooLong: 'seller.draft.varietyTooLong',
  countryTooLong: 'seller.draft.countryTooLong',
  originPlaceTooLong: 'seller.draft.originPlaceTooLong',
  quantityInvalid: 'seller.draft.quantityInvalid',
  quantityRangeInvalid: 'seller.draft.quantityRangeInvalid',
  priceInvalid: 'seller.draft.priceInvalid',
  forecastInvalid: 'seller.draft.forecastInvalid',
  harvestDateInvalid: 'seller.draft.harvestDateInvalid',
  harvestDateOrder: 'seller.draft.harvestDateOrder',
  seasonMonthsInvalid: 'seller.draft.seasonMonthsInvalid',
  harvestStatusInvalid: 'seller.draft.harvestStatusInvalid',
  packagingTypesInvalid: 'seller.draft.packagingTypesInvalid',
  packagingWeightsInvalid: 'seller.draft.packagingWeightsInvalid',
  palletTooLong: 'seller.draft.palletTooLong',
  incotermsInvalid: 'seller.draft.incotermsInvalid',
  carriersInvalid: 'seller.draft.carriersInvalid',
  customDeliveryTooLong: 'seller.draft.customDeliveryTooLong',
  nearestPortTooLong: 'seller.draft.nearestPortTooLong',
  leadTimeInvalid: 'seller.draft.leadTimeInvalid',
};

const FAILURE_KEY: Record<DraftFailure, MessageKey> = {
  validation: 'seller.draft.failed',
  unauthorized: 'seller.draft.failed',
  forbidden: 'seller.draft.failed',
  rateLimit: 'seller.draft.rateLimited',
  network: 'seller.draft.failed',
  generic: 'seller.draft.failed',
};

export function CreateProductScreen() {
  const { t } = useI18n();
  const { colors, spacing } = useTheme();
  const { api, status, user, profileUnavailable } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gate = useRef<DraftGate>({ pending: false });
  const [values, setValues] = useState<SellerProductFormValues>(EMPTY_PRODUCT_FORM);
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<DraftIssue | null>(null);
  const [failure, setFailure] = useState<DraftFailure | null>(null);
  const phase = createDraftPhase({
    authStatus: status === 'loading' ? 'loading' : status,
    user,
    profileUnavailable,
  });

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MyProducts');
  };

  const onSubmit = async () => {
    if (phase !== 'form') {
      return;
    }
    const result = await submitProductDraft({
      title: values.title,
      description: values.description,
      commercial: {
        category: values.category,
        variety: values.variety,
        country: values.country,
        originPlace: values.originPlace,
        unit: values.unit,
        minQuantity: values.minQuantity,
        maxQuantity: values.maxQuantity,
        currentStock: values.currentStock,
        monthlyProduction: values.monthlyProduction,
        maxAnnualProduction: values.maxAnnualProduction,
        price: values.price,
        currency: values.currency,
        priceNegotiable: values.priceNegotiable,
        priceDependsOnVolume: values.priceDependsOnVolume,
        seasonMonths: values.seasonMonths,
        harvestStartAt: values.harvestStartAt,
        harvestEndAt: values.harvestEndAt,
        forecastQuantity: values.forecastQuantity,
        harvestStatus: values.harvestStatus,
        preorderEnabled: values.preorderEnabled,
        packagingTypes: values.packagingTypes,
        packagingWeightsText: values.packagingWeightsText,
        palletSize: values.palletSize,
        deliveryAvailable: values.deliveryAvailable,
        incoterms: values.incoterms,
        carriers: values.carriers,
        customDelivery: values.customDelivery,
        nearestPort: values.nearestPort,
        leadTimeDays: values.leadTimeDays,
      },
      gate: gate.current,
      create: (body) => createProductDraft(api, body),
      onPending: setPending,
    });
    if (result.status === 'ignored') {
      return;
    }
    if (result.status === 'invalid') {
      setIssue(result.issue);
      setFailure(null);
      return;
    }
    if (result.status === 'failed') {
      setIssue(null);
      setFailure(result.failure);
      return;
    }
    const productId = editorAfterDraft(result);
    if (productId) {
      navigation.replace('EditProduct', { productId });
    }
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
          <ScreenHeader title={t('seller.draft.title')} backLabel={t('common.back')} onBack={leave} />
          {phase === 'session' ? <LoadingSkeleton accessibilityLabel={t('account.loading')} /> : null}
          {phase === 'signedOut' ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText tone="secondary">{t('account.signedOut')}</AppText>
                <AppButton label={t('account.signIn')} onPress={() => navigation.navigate('Login')} />
              </View>
            </Card>
          ) : null}
          {phase === 'unverified' ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText tone="secondary">{t('account.emailNotVerified')}</AppText>
                <AppButton label={t('account.confirmEmail')} onPress={() => navigation.navigate('VerifyEmail')} />
              </View>
            </Card>
          ) : null}
          {phase === 'profileUnavailable' ? (
            <AppText tone="secondary">{t('account.profileUnavailable')}</AppText>
          ) : null}
          {phase === 'form' ? (
            <SellerProductForm
              values={values}
              onChange={setValues}
              pending={pending}
              issueText={issue ? t(ISSUE_KEY[issue]) : null}
              failureText={failure ? t(FAILURE_KEY[failure]) : null}
              saveLabel={pending ? t('seller.draft.saving') : t('seller.draft.save')}
              onSubmit={() => {
                void onSubmit();
              }}
              media={
                <View style={{ gap: spacing.md }}>
                  <SellerProductPhotos
                    productId={null}
                    images={[]}
                    isPublished={false}
                    onUpdated={() => undefined}
                  />
                  <SellerProductVideoSection productId={null} videos={[]} onUpdated={() => undefined} />
                  <SellerProductCertificates productId={null} certificates={[]} onUpdated={() => undefined} />
                </View>
              }
            />
          ) : null}
        </ScrollView>
    </SafeAreaView>
  );
}
