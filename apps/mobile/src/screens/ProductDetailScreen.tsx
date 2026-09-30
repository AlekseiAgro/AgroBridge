import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../api/config';
import { ApiError } from '../api/errors';
import { resolveMediaUrl } from '../api/media-url';
import { useAuth } from '../auth/AuthProvider';
import { getProduct } from '../catalog/api';
import {
  categoryLabel,
  countryLabel,
  isHarvestStatus,
  regionLabel,
  unitLabel,
} from '../catalog/labels';
import {
  formatListedPrice,
  formatQuantityRange,
  type CatalogProduct,
} from '../catalog/model';
import { AppButton } from '../components/AppButton';
import { Badge, type BadgeTone } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { DetailRow } from '../components/DetailRow';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ProductPhotoGallery } from '../components/ProductPhotoGallery';
import { ScreenHeader } from '../components/ScreenHeader';
import { ShowOriginal } from '../components/ShowOriginal';
import { AppText } from '../components/AppText';
import { useI18n } from '../i18n/I18nProvider';
import { isAppLocale, LOCALE_LABELS } from '../i18n/locales';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

type Status = 'loading' | 'ready' | 'error' | 'notFound';

function badgeTone(status: string): BadgeTone {
  switch (status) {
    case 'available':
      return 'success';
    case 'limited':
      return 'warning';
    case 'soldOut':
      return 'danger';
    default:
      return 'neutral';
  }
}

function monthName(month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, month - 1, 1));
}

export function ProductDetailScreen() {
  const { locale, t } = useI18n();
  const { colors, spacing, radii } = useTheme();
  const { api, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const productId = route.params.productId;
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${productId}:${locale}:${reloadToken}`;
  const [seenKey, setSeenKey] = useState(requestKey);
  const [status, setStatus] = useState<Status>('loading');
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [quoteQuantity, setQuoteQuantity] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactPending, setContactPending] = useState(false);

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus('loading');
    setProduct(null);
    setShowOriginal(false);
  }

  useEffect(() => {
    let cancelled = false;
    getProduct(api, productId, locale)
      .then((next) => {
        if (cancelled) {
          return;
        }
        if (!next) {
          setStatus('notFound');
          return;
        }
        setProduct(next);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setStatus(error instanceof ApiError && error.status === 404 ? 'notFound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, locale, productId, reloadToken]);

  const harvest =
    product?.harvestStatus && isHarvestStatus(product.harvestStatus) ? product.harvestStatus : null;
  const unit = unitLabel(product?.unit, t);
  const price = product
    ? formatListedPrice(product.priceFrom, product.priceCurrency, unit)
    : null;
  const quantity = product
    ? formatQuantityRange(product.minQuantity, product.maxQuantity, unit)
    : null;
  const region = regionLabel(product?.farm?.region, t);
  const country = product ? countryLabel(product.country, t) : null;
  const place = [region, country].filter(Boolean).join(', ');
  const source = product?.source;
  const showing = showOriginal && source;
  const title = showing && source.title ? source.title : product?.title;
  const description = showing ? source.description : product?.description;
  const originPlace = showing ? source.originPlace : product?.originPlace;
  const variety = product?.variety;
  const differs = Boolean(
    product &&
      source &&
      [source.title, source.description, source.originPlace].some((original, index) => {
        const shown = [product.title, product.description, product.originPlace][index];
        return Boolean(original?.trim()) && (original ?? '').trim() !== (shown ?? '').trim();
      }),
  );
  const sourceLocale = source?.locale;
  const language =
    sourceLocale && isAppLocale(sourceLocale) ? LOCALE_LABELS[sourceLocale] : sourceLocale;
  const isOwner = Boolean(user && product && user.id === product.owner.id);
  const canContact = Boolean(user?.emailVerified) && !isOwner;
  const minimum =
    product?.minQuantity != null
      ? [String(product.minQuantity), unit].filter(Boolean).join(' ')
      : null;
  const stock =
    product?.currentStock != null
      ? [String(product.currentStock), unit].filter(Boolean).join(' ')
      : null;
  const season = product?.seasonMonths?.length
    ? product.seasonMonths.map((month) => monthName(month, locale)).join(', ')
    : null;
  const packaging = [
    ...(product?.packagingTypes ?? []),
    ...(product?.packagingWeights ?? []),
    product?.palletSize,
  ]
    .filter(Boolean)
    .join(', ');
  const delivery = [
    ...(product?.incoterms ?? []),
    product?.nearestPort,
    product?.leadTimeDays != null ? String(product.leadTimeDays) : null,
    product?.customDelivery,
    product?.deliveryAvailable ? t('product.delivery') : null,
  ]
    .filter(Boolean)
    .join(', ');
  const producerLabel =
    product?.farm?.producerType === 'individual'
      ? t('farm.producer.individual')
      : product?.farm?.producerType === 'family'
        ? t('farm.producer.family')
        : product?.farm?.producerType === 'cooperative'
          ? t('farm.producer.cooperative')
          : product?.farm?.producerType === 'company'
            ? t('farm.producer.company')
            : product?.farm?.producerType === 'other'
              ? t('farm.producer.other')
              : product?.farm?.ownershipType;

  async function sendQuote() {
    if (!product || !quoteQuantity.trim()) {
      return;
    }
    setContactPending(true);
    setContactError(null);
    setContactNotice(null);
    try {
      await api.request('/rfqs', {
        method: 'POST',
        body: {
          productId: product.id,
          quantity: quoteQuantity.trim(),
          unit: product.unit ?? undefined,
          message: quoteMessage.trim() || undefined,
        },
      });
      setContactNotice(t('product.quoteSent'));
      setQuoteQuantity('');
      setQuoteMessage('');
    } catch (error: unknown) {
      setContactError(error instanceof ApiError ? error.message : t('product.loadErrorBody'));
    } finally {
      setContactPending(false);
    }
  }

  async function sendMessage() {
    if (!product) {
      return;
    }
    setContactPending(true);
    setContactError(null);
    setContactNotice(null);
    try {
      await api.request('/conversations', {
        method: 'POST',
        body: { farmerId: product.owner.id, locale },
      });
      setContactNotice(t('product.messageSent'));
    } catch (error: unknown) {
      setContactError(error instanceof ApiError ? error.message : t('product.loadErrorBody'));
    } finally {
      setContactPending(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader
          title={title ?? t('home.newProducts')}
          backLabel={t('common.back')}
          onBack={() => navigation.goBack()}
        />
        {status === 'loading' ? <LoadingSkeleton accessibilityLabel={t('product.loading')} /> : null}
        {status === 'error' ? (
          <ErrorState
            title={t('product.loadErrorTitle')}
            body={t('product.loadErrorBody')}
            retryLabel={t('product.retry')}
            onRetry={() => setReloadToken((current) => current + 1)}
          />
        ) : null}
        {status === 'notFound' ? (
          <EmptyState title={t('product.notFoundTitle')} body={t('product.notFoundBody')} />
        ) : null}
        {status === 'ready' && product ? (
          <View style={{ gap: spacing.lg }}>
            <ProductPhotoGallery
              images={product.images}
              resolveUrl={(url) => resolveMediaUrl(url, apiBaseUrlFromEnv())}
              emptyLabel={t('common.noPhoto')}
              closeLabel={t('product.galleryClose')}
              previousLabel={t('product.galleryPrevious')}
              nextLabel={t('product.galleryNext')}
            />
            <View style={{ gap: spacing.sm }}>
              <AppText variant="title">{title}</AppText>
              {harvest ? (
                <Badge label={t(`availability.${harvest}`)} tone={badgeTone(harvest)} />
              ) : null}
              <DetailRow label={t('product.price')} value={price ?? t('product.priceOnRequest')} />
              <DetailRow label={t('product.quantity')} value={quantity} />
              <DetailRow label={t('product.stock')} value={stock} />
              {product.farm ? (
                <AppButton
                  label={product.farm.name}
                  variant="ghost"
                  accessibilityLabel={t('a11y.openFarm', { name: product.farm.name })}
                  onPress={() => navigation.navigate('FarmDetail', { farmId: product.farm?.id ?? '' })}
                />
              ) : (
                <DetailRow label={t('product.seller')} value={product.owner.displayName} />
              )}
              {place ? <AppText tone="secondary">{place}</AppText> : null}
              {product.farm?.verified ? (
                <AppText variant="caption" tone="brand">
                  {t('home.verifiedFarm')}
                </AppText>
              ) : null}
              {product.sellerRating && product.sellerRating.count > 0 ? (
                <AppText variant="caption" tone="secondary">
                  {product.sellerRating.average ?? '–'} ({product.sellerRating.count})
                </AppText>
              ) : null}
            </View>

            {!isOwner ? (
              <Card padded>
                <View style={{ gap: spacing.md }}>
                  {!user ? (
                    <AppButton
                      label={t('product.signInToContact')}
                      onPress={() => navigation.navigate('Main', { screen: 'Account' })}
                    />
                  ) : !user.emailVerified ? (
                    <AppText>{t('product.verifyToContact')}</AppText>
                  ) : canContact ? (
                    <>
                      {harvest !== 'soldOut' ? (
                        <>
                      <TextInput
                        value={quoteQuantity}
                        onChangeText={setQuoteQuantity}
                        placeholder={t('product.quoteQuantity')}
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        style={{
                          minHeight: 44,
                          borderWidth: 1,
                          borderColor: colors.line,
                          borderRadius: radii.md,
                          paddingHorizontal: spacing.md,
                          color: colors.ink,
                        }}
                      />
                      <TextInput
                        value={quoteMessage}
                        onChangeText={setQuoteMessage}
                        placeholder={t('product.quoteMessage')}
                        placeholderTextColor={colors.muted}
                        multiline
                        style={{
                          minHeight: 88,
                          borderWidth: 1,
                          borderColor: colors.line,
                          borderRadius: radii.md,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                          color: colors.ink,
                        }}
                      />
                      <AppButton
                        label={t('product.requestQuote')}
                        onPress={sendQuote}
                        loading={contactPending}
                        disabled={!quoteQuantity.trim()}
                      />
                        </>
                      ) : null}
                      <AppButton
                        label={t('product.messageSeller')}
                        variant="secondary"
                        onPress={sendMessage}
                        loading={contactPending}
                      />
                    </>
                  ) : null}
                  {contactNotice ? <AppText tone="brand">{contactNotice}</AppText> : null}
                  {contactError ? <AppText tone="danger">{contactError}</AppText> : null}
                </View>
              </Card>
            ) : null}

            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText variant="label">{t('product.characteristics')}</AppText>
                {categoryLabel(product.category, t) ? (
                  <Chip label={categoryLabel(product.category, t) ?? product.category ?? ''} />
                ) : null}
                <DetailRow label={t('requests.variety')} value={variety} />
                <DetailRow label={t('product.origin')} value={originPlace} />
                <DetailRow label={t('requests.packaging')} value={packaging || null} />
                <DetailRow label={t('product.minimumOrder')} value={minimum} />
                <DetailRow label={t('product.quantity')} value={quantity} />
                <DetailRow label={t('product.stock')} value={stock} />
                <DetailRow label={t('product.season')} value={season} />
              </View>
            </Card>

            <Card padded>
              <DetailRow label={t('product.description')} value={description} />
              <ShowOriginal
                differs={differs}
                open={showOriginal}
                onToggle={() => setShowOriginal((value) => !value)}
                showOriginalLabel={t('catalog.showOriginal')}
                showTranslationLabel={t('catalog.showTranslation')}
                originalLanguageLabel={t('catalog.originalLanguage', { language: language ?? '' })}
              />
            </Card>

            {product.farm ? (
              <Card padded>
                <View style={{ gap: spacing.md }}>
                  <AppText variant="label">{t('farm.title')}</AppText>
                  <AppButton
                    label={product.farm.name}
                    variant="ghost"
                    accessibilityLabel={t('a11y.openFarm', { name: product.farm.name })}
                    onPress={() => navigation.navigate('FarmDetail', { farmId: product.farm?.id ?? '' })}
                  />
                  <DetailRow label={t('farm.about')} value={place} />
                  <DetailRow label={t('farm.producerType')} value={producerLabel} />
                  {product.farm.verified ? (
                    <AppText variant="caption" tone="brand">
                      {t('home.verifiedFarm')}
                    </AppText>
                  ) : null}
                  <AppButton
                    label={t('product.viewFarm')}
                    variant="secondary"
                    onPress={() => navigation.navigate('FarmDetail', { farmId: product.farm?.id ?? '' })}
                  />
                </View>
              </Card>
            ) : null}

            {delivery ? (
              <Card padded>
                <DetailRow label={t('product.delivery')} value={delivery} />
              </Card>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
