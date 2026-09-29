import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../../api/config';
import { resolveMediaUrl } from '../../api/media-url';
import type { BadgeTone } from '../../components/Badge';
import { AppIconButton } from '../../components/AppIconButton';
import { AppText } from '../../components/AppText';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { ProductCard } from '../../components/ProductCard';
import { RequestCard } from '../../components/RequestCard';
import { SearchBar } from '../../components/SearchBar';
import { SectionHeader } from '../../components/SectionHeader';
import {
  categoryLabel,
  countryLabel,
  isHarvestStatus,
  regionLabel,
  unitLabel,
} from '../../catalog/labels';
import type { CatalogProduct, CatalogRequest } from '../../catalog/model';
import { primaryProductImageUrl } from '../../catalog/model';
import { normalizeQueryParam } from '../../catalog/query';
import { useHomeFeed } from '../../catalog/use-home-feed';
import { useI18n } from '../../i18n/I18nProvider';
import type { RootStackParamList, RootTabParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';

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

export function HomeScreen() {
  const { t } = useI18n();
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const stack = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const feed = useHomeFeed(categoryId, query);
  const cardWidth = Math.min(300, Math.max(200, Math.round(width * 0.72)));
  const queryParam = normalizeQueryParam(query);

  const products = queryParam ? feed.serverProducts : feed.products;
  const requests = queryParam ? feed.serverRequests : feed.requests;

  const hasFilters = Boolean(queryParam || categoryId);
  const waitingForSearch =
    feed.searchPending && products.length === 0 && requests.length === 0;
  const isEmpty =
    feed.status === 'ready' &&
    !waitingForSearch &&
    !feed.searchError &&
    products.length === 0 &&
    requests.length === 0;
  const showResults =
    feed.status === 'ready' &&
    !waitingForSearch &&
    !(feed.searchError && products.length === 0 && requests.length === 0);

  const clearFilters = () => {
    setQuery('');
    setCategoryId(null);
  };

  const openProduct = (productId: string) => {
    stack?.navigate('ProductDetail', { productId });
  };

  const openRequest = (requestId: string) => {
    stack?.navigate('RequestDetail', { requestId });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <AppText variant="headline">AgroBridge</AppText>
            <AppText variant="caption" tone="secondary">
              {t('home.platform')}
            </AppText>
          </View>
          <AppIconButton
            name="notifications-outline"
            accessibilityLabel={t('home.notifications')}
            onPress={() => navigation.navigate('Notifications')}
          />
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={t('home.searchPlaceholder')}
          accessibilityLabel={t('home.searchLabel')}
          clearLabel={t('home.clearSearch')}
        />

        {feed.status === 'loading' && !feed.bootstrapped ? (
          <LoadingSkeleton accessibilityLabel={t('home.loading')} />
        ) : null}
        {feed.status === 'error' ? (
          <ErrorState
            title={t('home.loadErrorTitle')}
            body={t('home.loadErrorBody')}
            retryLabel={t('home.retry')}
            onRetry={feed.reload}
          />
        ) : null}

        {feed.status !== 'error' && (feed.status === 'ready' || feed.bootstrapped) ? (
          <View style={{ gap: spacing.xl }}>
            <View>
              <SectionHeader title={t('home.categories')} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.chips, { gap: spacing.sm }]}
              >
                {feed.categories.map((category) => {
                  const selected = categoryId === category.id;
                  const label = categoryLabel(category.id, t) ?? category.id;
                  return (
                    <Chip
                      key={category.id}
                      label={label}
                      selected={selected}
                      accessibilityLabel={
                        selected
                          ? t('a11y.clearCategory')
                          : t('a11y.selectCategory', { category: label })
                      }
                      onPress={() => setCategoryId(selected ? null : category.id)}
                    />
                  );
                })}
              </ScrollView>
            </View>

            {feed.status === 'loading' || waitingForSearch ? (
              <LoadingSkeleton accessibilityLabel={t('home.loading')} />
            ) : null}
            {feed.searchError && products.length === 0 && requests.length === 0 ? (
              <ErrorState
                title={t('home.loadErrorTitle')}
                body={t('home.loadErrorBody')}
                retryLabel={t('home.retry')}
                onRetry={feed.reload}
              />
            ) : null}
            {showResults && isEmpty ? (
              <EmptyState
                title={hasFilters ? t('home.emptySearchTitle') : t('home.emptyCatalogTitle')}
                body={hasFilters ? t('home.emptySearchBody') : t('home.emptyCatalogBody')}
                actionLabel={hasFilters ? t('home.clearSearch') : undefined}
                onAction={hasFilters ? clearFilters : undefined}
              />
            ) : null}
            {showResults && !isEmpty ? (
              <>
                {products.length > 0 ? (
                  <View>
                    <SectionHeader title={t('home.newProducts')} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={[styles.chips, { gap: spacing.md }]}
                    >
                      {products.map((product) => (
                        <ProductTile
                          key={product.id}
                          product={product}
                          width={cardWidth}
                          onPress={() => openProduct(product.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {requests.length > 0 ? (
                  <View style={{ gap: spacing.md }}>
                    <SectionHeader title={t('home.opportunities')} />
                    {requests.map((request) => (
                      <RequestTile
                        key={request.id}
                        request={request}
                        onPress={() => openRequest(request.id)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProductTile({
  product,
  width,
  onPress,
}: {
  product: CatalogProduct;
  width: number;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const region = regionLabel(product.farm?.region, t);
  const country = countryLabel(product.country, t);
  const meta = [product.farm?.name, region, country].filter(Boolean).join(' · ');
  const harvest = product.harvestStatus && isHarvestStatus(product.harvestStatus)
    ? product.harvestStatus
    : null;
  const badge = harvest ? t(`availability.${harvest}`) : '';

  return (
    <ProductCard
      name={product.title}
      imageUrl={resolveMediaUrl(primaryProductImageUrl(product.images), apiBaseUrlFromEnv())}
      meta={meta}
      badgeLabel={badge}
      badgeTone={harvest ? badgeTone(harvest) : 'neutral'}
      verifiedLabel={product.farm?.verified ? t('home.verifiedFarm') : null}
      noPhotoLabel={t('common.noPhoto')}
      accessibilityLabel={t('a11y.openProduct', { name: product.title })}
      width={width}
      onPress={onPress}
    />
  );
}

function RequestTile({ request, onPress }: { request: CatalogRequest; onPress: () => void }) {
  const { t } = useI18n();
  const quantity = [request.quantity, unitLabel(request.unit, t)].filter(Boolean).join(' ');
  const meta = [quantity, request.destinationCountry, request.buyer.displayName]
    .filter(Boolean)
    .join(' · ');
  const category = categoryLabel(request.category, t) ?? request.category;

  return (
    <RequestCard
      title={request.title}
      meta={meta}
      categoryLabel={category}
      accessibilityLabel={t('a11y.openRequest', { name: request.title })}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: {
    flex: 1,
    flexShrink: 1,
  },
  chips: {
    paddingRight: 4,
  },
});
