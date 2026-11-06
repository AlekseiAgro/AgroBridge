import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../api/config';
import { resolveMediaUrl } from '../api/media-url';
import { useAuth } from '../auth/AuthProvider';
import { listProducts } from '../catalog/api';
import {
  activeFilterCount,
  catalogFiltersFromRoute,
  catalogProductsInput,
  filterSummaryLabel,
  type CatalogFilters,
} from '../catalog/filters';
import { countryLabel, isHarvestStatus, regionLabel } from '../catalog/labels';
import { primaryProductImageUrl, type CatalogProduct } from '../catalog/model';
import { CatalogFilterSheet } from '../components/CatalogFilterSheet';
import type { BadgeTone } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { ProductCard } from '../components/ProductCard';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchBar } from '../components/SearchBar';
import { AppText } from '../components/AppText';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';

type Status = 'loading' | 'ready' | 'error';

export function CatalogScreen() {
  const { locale, t } = useI18n();
  const { colors, spacing, radii, borders } = useTheme();
  const { api } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Catalog'>>();
  const routeKey = JSON.stringify(route.params ?? {});
  const [seenKey, setSeenKey] = useState(routeKey);
  const [query, setQuery] = useState(route.params?.query ?? '');
  const [filters, setFilters] = useState<CatalogFilters>(catalogFiltersFromRoute(route.params));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const filterKey = [
    query,
    filters.categoryId,
    filters.regions.join('\n'),
    filters.harvestStatus,
    filters.preorder,
    filters.inSeason,
    locale,
    reloadToken,
  ].join('|');
  const [seenFilter, setSeenFilter] = useState(filterKey);
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey);
    setStatus('loading');
  }

  if (seenKey !== routeKey) {
    setSeenKey(routeKey);
    setQuery(route.params?.query ?? '');
    setFilters(catalogFiltersFromRoute(route.params));
  }

  useEffect(() => {
    let cancelled = false;
    listProducts(api, catalogProductsInput(filters, { query, locale }))
      .then((next) => {
        if (cancelled) return;
        setProducts(next);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, filters, locale, query, reloadToken]);

  const summary = filterSummaryLabel(t('home.filters'), activeFilterCount(filters));

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
        <ScreenHeader title={t('catalog.title')} backLabel={t('common.back')} onBack={() => navigation.goBack()} />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('home.searchPlaceholder')}
          accessibilityLabel={t('home.searchLabel')}
          clearLabel={t('home.clearSearch')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={summary}
          onPress={() => setFiltersOpen(true)}
          style={{
            minHeight: 48,
            borderRadius: radii.md,
            borderWidth: borders.hairline,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <AppText style={{ flex: 1 }}>{summary}</AppText>
          <Ionicons name="options-outline" size={20} color={colors.brand} />
        </Pressable>
        {status === 'loading' ? <LoadingSkeleton accessibilityLabel={t('home.loading')} /> : null}
        {status === 'error' ? (
          <ErrorState
            title={t('home.loadErrorTitle')}
            body={t('home.loadErrorBody')}
            retryLabel={t('home.retry')}
            onRetry={() => setReloadToken((current) => current + 1)}
          />
        ) : null}
        {status === 'ready' && products.length === 0 ? (
          <EmptyState title={t('catalog.emptyTitle')} body={t('catalog.emptyBody')} />
        ) : null}
        {status === 'ready'
          ? products.map((product) => {
              const harvest =
                product.harvestStatus && isHarvestStatus(product.harvestStatus) ? product.harvestStatus : null;
              const regionName = regionLabel(product.farm?.region, t);
              const country = countryLabel(product.country, t);
              return (
                <ProductCard
                  key={product.id}
                  name={product.title}
                  imageUrl={resolveMediaUrl(primaryProductImageUrl(product.images), apiBaseUrlFromEnv())}
                  meta={[product.farm?.name, regionName, country].filter(Boolean).join(' · ')}
                  badgeLabel={harvest ? t(`availability.${harvest}`) : ''}
                  badgeTone={harvestTone(harvest)}
                  verifiedLabel={product.farm?.verified ? t('home.verifiedFarm') : null}
                  noPhotoLabel={t('common.noPhoto')}
                  accessibilityLabel={t('a11y.openProduct', { name: product.title })}
                  onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
                />
              );
            })
          : null}
      </ScrollView>
      <CatalogFilterSheet
        visible={filtersOpen}
        value={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function harvestTone(status: string | null): BadgeTone {
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
