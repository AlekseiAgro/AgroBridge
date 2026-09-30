import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../api/config';
import { ApiError } from '../api/errors';
import { resolveMediaUrl } from '../api/media-url';
import { useAuth } from '../auth/AuthProvider';
import { getFarm } from '../catalog/api';
import { regionLabel } from '../catalog/labels';
import {
  primaryProductImageUrl,
  type CatalogFarmProfile,
  type CatalogProduct,
} from '../catalog/model';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { DetailRow } from '../components/DetailRow';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ProductCard } from '../components/ProductCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { ShowOriginal } from '../components/ShowOriginal';
import { useI18n } from '../i18n/I18nProvider';
import { isAppLocale, LOCALE_LABELS } from '../i18n/locales';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

type Status = 'loading' | 'ready' | 'error' | 'notFound';

function same(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? '').trim() === (right ?? '').trim();
}

export function FarmDetailScreen() {
  const { locale, t } = useI18n();
  const { colors, spacing } = useTheme();
  const { api } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'FarmDetail'>>();
  const farmId = route.params.farmId;
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${farmId}:${locale}:${reloadToken}`;
  const [seenKey, setSeenKey] = useState(requestKey);
  const [status, setStatus] = useState<Status>('loading');
  const [farm, setFarm] = useState<CatalogFarmProfile | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus('loading');
    setFarm(null);
    setShowOriginal(false);
  }

  useEffect(() => {
    let cancelled = false;
    getFarm(api, farmId, locale)
      .then((next) => {
        if (cancelled) {
          return;
        }
        if (!next) {
          setStatus('notFound');
          return;
        }
        setFarm(next);
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
  }, [api, farmId, locale, reloadToken]);

  const copy = showOriginal && farm ? farm.source : farm?.display;
  const differs = Boolean(
    farm &&
      (!same(farm.display.description, farm.source.description) ||
        !same(farm.display.history, farm.source.history) ||
        !same(farm.display.ownershipType, farm.source.ownershipType) ||
        farm.display.exportMarkets.join('\n') !== farm.source.exportMarkets.join('\n')),
  );
  const sourceLocale = farm?.source.locale;
  const language = sourceLocale && isAppLocale(sourceLocale) ? LOCALE_LABELS[sourceLocale] : sourceLocale;
  const place = farm ? regionLabel(farm.region, t) : null;

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
          title={farm?.name ?? t('farm.title')}
          backLabel={t('common.back')}
          onBack={() => navigation.goBack()}
        />
        {status === 'loading' ? <LoadingSkeleton accessibilityLabel={t('farm.loading')} /> : null}
        {status === 'error' ? (
          <ErrorState
            title={t('farm.loadErrorTitle')}
            body={t('farm.loadErrorBody')}
            retryLabel={t('farm.retry')}
            onRetry={() => setReloadToken((current) => current + 1)}
          />
        ) : null}
        {status === 'notFound' ? (
          <EmptyState title={t('farm.notFoundTitle')} body={t('farm.notFoundBody')} />
        ) : null}
        {status === 'ready' && farm && copy ? (
          <View style={{ gap: spacing.lg }}>
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText variant="title">{farm.name}</AppText>
                {farm.verified ? (
                  <AppText variant="caption" tone="brand">
                    {t('farm.verified')}
                  </AppText>
                ) : null}
                {place ? <AppText tone="secondary">{place}</AppText> : null}
                {farm.companyRegistryName ? (
                  <DetailRow label={t('farm.registeredName')} value={farm.companyRegistryName} />
                ) : null}
                <DetailRow label={t('farm.about')} value={copy.description} />
                <DetailRow label={t('farm.ownership')} value={copy.ownershipType} />
                <DetailRow
                  label={t('farm.markets')}
                  value={copy.exportMarkets.length > 0 ? copy.exportMarkets.join(', ') : null}
                />
                {farm.foundedYear ? (
                  <DetailRow label={t('farm.founded')} value={String(farm.foundedYear)} />
                ) : null}
                {farm.farmSizeHectares != null ? (
                  <DetailRow label={t('farm.size')} value={String(farm.farmSizeHectares)} />
                ) : null}
                <DetailRow label={t('farm.history')} value={copy.history} />
                <ShowOriginal
                  differs={differs}
                  open={showOriginal}
                  onToggle={() => setShowOriginal((value) => !value)}
                  showOriginalLabel={t('catalog.showOriginal')}
                  showTranslationLabel={t('catalog.showTranslation')}
                  originalLanguageLabel={t('catalog.originalLanguage', { language: language ?? '' })}
                />
              </View>
            </Card>
            <AppText variant="title">{t('farm.products')}</AppText>
            {farm.products.length === 0 ? (
              <EmptyState title={t('farm.noProducts')} body={t('farm.noProductsBody')} />
            ) : (
              farm.products.map((product) => (
                <FarmProduct
                  key={product.id}
                  product={product}
                  onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
                />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function FarmProduct({ product, onPress }: { product: CatalogProduct; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <ProductCard
        name={product.title}
        imageUrl={resolveMediaUrl(primaryProductImageUrl(product.images), apiBaseUrlFromEnv())}
        meta=""
        badgeLabel=""
        badgeTone="neutral"
        noPhotoLabel={t('common.noPhoto')}
        accessibilityLabel={t('a11y.openProduct', { name: product.title })}
      />
    </Pressable>
  );
}
