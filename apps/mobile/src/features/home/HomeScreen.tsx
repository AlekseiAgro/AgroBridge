import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../../api/config';
import { resolveMediaUrl } from '../../api/media-url';
import type { BadgeTone } from '../../components/Badge';
import { AppIconButton } from '../../components/AppIconButton';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { ProductCard } from '../../components/ProductCard';
import { SearchBar } from '../../components/SearchBar';
import { SectionHeader } from '../../components/SectionHeader';
import {
  SHOWCASE_CATEGORIES,
  type Availability,
  type ProductCategory,
} from '../../catalog/categories';
import { useI18n } from '../../i18n/I18nProvider';
import type { RootTabParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { filterHomeFeed } from './filter-home-feed';
import { loadHomeFeed } from './fixtures';
import {
  availabilityLabelKey,
  categoryLabelKey,
  regionLabelKey,
  type HomeFeed,
  type PresentationProduct,
  type PresentationRequest,
} from './types';

function badgeTone(availability: Availability): BadgeTone {
  switch (availability) {
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
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<ProductCategory | null>(null);
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [requestId, setRequestId] = useState(0);

  const featuredWidth = Math.min(300, Math.max(200, Math.round(width * 0.72)));

  const reload = () => {
    setStatus('loading');
    setFeed(null);
    setRequestId((current) => current + 1);
  };

  useEffect(() => {
    let cancelled = false;
    loadHomeFeed()
      .then((next) => {
        if (!cancelled) {
          setFeed(next);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFeed(null);
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const filtered = useMemo(() => {
    if (!feed) {
      return null;
    }
    return filterHomeFeed(feed, { query, categoryId, text: t });
  }, [feed, query, categoryId, t]);

  const featured = filtered?.products.filter((product) => product.placement === 'featured') ?? [];
  const fresh = filtered?.products.filter((product) => product.placement === 'new') ?? [];
  const requests = filtered?.requests ?? [];
  const isEmpty =
    status === 'ready' && featured.length === 0 && fresh.length === 0 && requests.length === 0;

  const clearFilters = () => {
    setQuery('');
    setCategoryId(null);
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

        <AppText variant="caption" tone="muted">
          {t('home.presentationNote')}
        </AppText>

        {status === 'loading' ? <LoadingSkeleton accessibilityLabel={t('home.loading')} /> : null}
        {status === 'error' ? (
          <ErrorState
            title={t('home.loadErrorTitle')}
            body={t('home.loadErrorBody')}
            retryLabel={t('home.retry')}
            onRetry={reload}
          />
        ) : null}

        {status === 'ready' && filtered ? (
          <View style={{ gap: spacing.xl }}>
            <View>
              <SectionHeader title={t('home.categories')} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.chips, { gap: spacing.sm }]}
              >
                {SHOWCASE_CATEGORIES.map((category) => {
                  const selected = categoryId === category;
                  const label = t(categoryLabelKey(category));
                  return (
                    <Chip
                      key={category}
                      label={label}
                      selected={selected}
                      accessibilityLabel={
                        selected
                          ? t('a11y.clearCategory')
                          : t('a11y.selectCategory', { category: label })
                      }
                      onPress={() => setCategoryId(selected ? null : category)}
                    />
                  );
                })}
              </ScrollView>
            </View>

            {isEmpty ? (
              <EmptyState
                title={t('home.emptySearchTitle')}
                body={t('home.emptySearchBody')}
                actionLabel={t('home.clearSearch')}
                onAction={clearFilters}
              />
            ) : (
              <>
                {featured.length > 0 ? (
                  <View>
                    <SectionHeader title={t('home.featured')} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={[styles.chips, { gap: spacing.md }]}
                    >
                      {featured.map((product) => (
                        <ProductTile
                          key={product.id}
                          product={product}
                          width={featuredWidth}
                          country={t('home.country.georgia')}
                          region={t(regionLabelKey(product.regionId))}
                          badgeLabel={t(availabilityLabelKey(product.availability))}
                          verifiedLabel={product.verified ? t('home.verifiedFarm') : null}
                          noPhotoLabel={t('common.noPhoto')}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {fresh.length > 0 ? (
                  <View style={{ gap: spacing.md }}>
                    <SectionHeader title={t('home.newProducts')} />
                    {fresh.map((product) => (
                      <ProductTile
                        key={product.id}
                        product={product}
                        country={t('home.country.georgia')}
                        region={t(regionLabelKey(product.regionId))}
                        badgeLabel={t(availabilityLabelKey(product.availability))}
                        verifiedLabel={product.verified ? t('home.verifiedFarm') : null}
                        noPhotoLabel={t('common.noPhoto')}
                      />
                    ))}
                  </View>
                ) : null}

                {requests.length > 0 ? (
                  <View style={{ gap: spacing.md }}>
                    <SectionHeader title={t('home.opportunities')} />
                    {requests.map((request) => (
                      <RequestTile key={request.id} request={request} />
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProductTile({
  product,
  width,
  country,
  region,
  badgeLabel,
  verifiedLabel,
  noPhotoLabel,
}: {
  product: PresentationProduct;
  width?: number;
  country: string;
  region: string;
  badgeLabel: string;
  verifiedLabel: string | null;
  noPhotoLabel: string;
}) {
  const { t } = useI18n();
  const name = t(product.nameKey);

  return (
    <ProductCard
      name={name}
      imageUrl={resolveMediaUrl(product.imageUrl, apiBaseUrlFromEnv())}
      meta={`${region} · ${country}`}
      badgeLabel={badgeLabel}
      badgeTone={badgeTone(product.availability)}
      verifiedLabel={verifiedLabel}
      noPhotoLabel={noPhotoLabel}
      accessibilityLabel={`${name}, ${region}, ${badgeLabel}`}
      width={width}
    />
  );
}

function RequestTile({ request }: { request: PresentationRequest }) {
  const { t } = useI18n();
  const { spacing } = useTheme();
  const title = t(request.titleKey);
  const meta = `${t(regionLabelKey(request.regionId))} · ${t('home.country.georgia')} · ${t(request.quantityKey)}`;

  return (
    <Card padded accessibilityLabel={`${title}. ${meta}`}>
      <View style={{ gap: spacing.sm }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {meta}
        </AppText>
        <Chip label={t(categoryLabelKey(request.categoryId))} />
      </View>
    </Card>
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
