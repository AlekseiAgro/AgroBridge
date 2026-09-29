import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
  primaryProductImageUrl,
  type CatalogProduct,
} from '../catalog/model';
import type { BadgeTone } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { DetailRow } from '../components/DetailRow';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ProductCard } from '../components/ProductCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { useI18n } from '../i18n/I18nProvider';
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

export function ProductDetailScreen() {
  const { locale, t } = useI18n();
  const { colors, spacing } = useTheme();
  const { api } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const productId = route.params.productId;
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${productId}:${locale}:${reloadToken}`;
  const [seenKey, setSeenKey] = useState(requestKey);
  const [status, setStatus] = useState<Status>('loading');
  const [product, setProduct] = useState<CatalogProduct | null>(null);

  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setStatus('loading');
    setProduct(null);
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
  const seller = product?.farm?.name || product?.owner.displayName || null;
  const region = regionLabel(product?.farm?.region, t);
  const meta = [seller, region, product ? countryLabel(product.country, t) : null]
    .filter(Boolean)
    .join(' · ');

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
          title={product?.title ?? t('home.newProducts')}
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
            <ProductCard
              name={product.title}
              imageUrl={resolveMediaUrl(primaryProductImageUrl(product.images), apiBaseUrlFromEnv())}
              meta={meta}
              badgeLabel={harvest ? t(`availability.${harvest}`) : ''}
              badgeTone={harvest ? badgeTone(harvest) : 'neutral'}
              verifiedLabel={product.farm?.verified ? t('home.verifiedFarm') : null}
              noPhotoLabel={t('common.noPhoto')}
              accessibilityLabel={product.title}
            />
            <Card padded>
              <View style={{ gap: spacing.md }}>
                {categoryLabel(product.category, t) ? (
                  <Chip label={categoryLabel(product.category, t) ?? product.category ?? ''} />
                ) : null}
                <DetailRow label={t('product.seller')} value={seller} />
                <DetailRow label={t('product.price')} value={price ?? t('product.priceOnRequest')} />
                <DetailRow label={t('product.quantity')} value={quantity} />
                <DetailRow label={t('product.original')} value={product.sourceTitle} />
                <DetailRow label={t('product.description')} value={product.description} />
                <DetailRow label={t('requests.variety')} value={product.variety} />
                <DetailRow label={t('product.origin')} value={product.originPlace} />
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
