import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv } from '../api/config';
import { resolveMediaUrl } from '../api/media-url';
import { useAuth } from '../auth/AuthProvider';
import { unitLabel } from '../catalog/labels';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Badge, type BadgeTone } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ScreenHeader } from '../components/ScreenHeader';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import type { RootStackParamList } from '../navigation/types';
import { submitHarvestUpdate, type HarvestUpdateFailure } from '../seller/availability';
import {
  beginProductDelete,
  canDeleteSellerProduct,
  takeDeletedProductId,
  type DeleteFailure,
} from '../seller/delete';
import { askToDeleteProduct } from '../seller/delete-alert';
import { showCreateProductAction, type DraftGate } from '../seller/draft';
import {
  filterMyProducts,
  HARVEST_STATUS_CHOICES,
  harvestBadgeKey,
  harvestChoiceSelected,
  MY_PRODUCT_FILTERS,
  myProductsPhase,
  myProductsRefreshVisible,
  openAvailabilitySheet,
  sellerListStatus,
  sellerMetricCount,
  sellerPriceLine,
  sellerProductDestination,
  sellerProductImageUrl,
  sellerRejectionNote,
  UPDATE_AVAILABILITY_KEY,
  type HarvestChoice,
  type MyProductFilter,
  type SellerListStatus,
  type SellerProduct,
} from '../seller/products';
import { deleteSellerProduct, updateSellerHarvestStatus } from '../seller/products-api';
import { useMyProducts } from '../seller/use-my-products';
import { useTheme } from '../theme/ThemeProvider';

const STATUS_KEY: Record<SellerListStatus, MessageKey> = {
  draft: 'seller.products.status.draft',
  pending: 'seller.products.status.pending',
  published: 'seller.products.status.published',
  rejected: 'seller.products.status.rejected',
  approvedUnpublished: 'seller.products.status.approvedUnpublished',
};

const STATUS_TONE: Record<SellerListStatus, BadgeTone> = {
  draft: 'neutral',
  pending: 'warning',
  published: 'success',
  rejected: 'danger',
  approvedUnpublished: 'success',
};

const STATUS_OUTLINE: Record<SellerListStatus, boolean> = {
  draft: false,
  pending: false,
  published: false,
  rejected: false,
  approvedUnpublished: true,
};

const FILTER_KEY: Record<MyProductFilter, MessageKey> = {
  all: 'seller.products.filter.all',
  published: 'seller.products.filter.published',
  pending: 'seller.products.filter.pending',
};

const DELETE_FAILURE_KEY: Record<DeleteFailure, MessageKey> = {
  validation: 'seller.delete.failed',
  unauthorized: 'seller.delete.unauthorized',
  forbidden: 'seller.delete.forbidden',
  rateLimit: 'seller.delete.failed',
  network: 'seller.delete.network',
  generic: 'seller.delete.failed',
  notFound: 'seller.delete.notFound',
  conflict: 'seller.delete.conflict',
};

export function MyProductsScreen() {
  const { t } = useI18n();
  const { api } = useAuth();
  const { colors, spacing, radii, touchTarget } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const feed = useMyProducts();
  const removeProduct = feed.removeProduct;
  const replaceProduct = feed.replaceProduct;
  const deleteGate = useRef<DraftGate>({ pending: false });
  const harvestGate = useRef<DraftGate>({ pending: false });
  const [filter, setFilter] = useState<MyProductFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [harvestId, setHarvestId] = useState<string | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<{ productId: string; failure: DeleteFailure } | null>(null);
  const [harvestFailure, setHarvestFailure] = useState<{ productId: string; failure: HarvestUpdateFailure } | null>(
    null,
  );
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [availabilitySheet, setAvailabilitySheet] = useState<{ productId: string } | null>(null);
  const visibleProducts = filterMyProducts(feed.products, filter);

  useFocusEffect(
    useCallback(() => {
      const productId = takeDeletedProductId();
      if (!productId) {
        return;
      }
      removeProduct(productId);
      setDeletedNotice(true);
      setDeleteFailure(null);
    }, [removeProduct]),
  );

  const onDelete = async (product: SellerProduct) => {
    if (!canDeleteSellerProduct(product)) {
      return;
    }
    const result = await beginProductDelete({
      product,
      ask: (prompt) =>
        askToDeleteProduct(prompt, {
          title: t('seller.delete.title'),
          body: t('seller.delete.body', { name: prompt.productTitle }),
          cancel: t('seller.delete.cancel'),
          confirm: t('seller.delete.confirm'),
        }),
      gate: deleteGate.current,
      remove: (productId) => deleteSellerProduct(api, productId),
      onPending: (pending) => setDeletingId(pending ? product.id : null),
    });
    if (result.status === 'cancelled' || result.status === 'ignored') {
      return;
    }
    if (result.status === 'failed') {
      setDeleteFailure({ productId: product.id, failure: result.failure });
      setDeletedNotice(false);
      return;
    }
    takeDeletedProductId();
    feed.removeProduct(product.id);
    setDeleteFailure(null);
    setDeletedNotice(true);
  };

  const onChooseHarvest = async (product: SellerProduct, next: HarvestChoice | 'dismiss') => {
    setAvailabilitySheet(null);
    const result = await submitHarvestUpdate({
      current: product.harvestStatus,
      next,
      gate: harvestGate.current,
      apply: (body) => updateSellerHarvestStatus(api, product.id, body),
      onPending: (pending) => setHarvestId(pending ? product.id : null),
    });
    if (result.status === 'updated') {
      replaceProduct(result.product);
      setHarvestFailure(null);
      return;
    }
    if (result.status === 'failed') {
      setHarvestFailure({ productId: product.id, failure: result.failure });
    }
  };

  const phase = myProductsPhase({
    authStatus: feed.authStatus === 'loading' ? 'loading' : feed.authStatus,
    user: feed.user,
    profileUnavailable: feed.profileUnavailable,
    loadStatus: feed.loadStatus,
    count: visibleProducts.length,
  });
  const filterEmpty = phase === 'empty' && filter !== 'all' && feed.products.length > 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        refreshControl={
          myProductsRefreshVisible(phase) ? (
            <RefreshControl
              refreshing={feed.refreshing}
              onRefresh={() => {
                setDeletedNotice(false);
                feed.reload();
              }}
              tintColor={colors.brand}
            />
          ) : undefined
        }
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xxxl,
          gap: spacing.md,
        }}
      >
        <ScreenHeader title={t('seller.products.title')} backLabel={t('common.back')} onBack={() => navigation.goBack()} />
        {showCreateProductAction(phase) && (phase === 'list' || filterEmpty) ? (
          <AppButton
            label={t('seller.draft.create')}
            variant="secondary"
            onPress={() => navigation.navigate('CreateProduct')}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : null}
        {feed.loadStatus === 'ready' ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
          >
            {MY_PRODUCT_FILTERS.map((value) => (
              <Chip
                key={value}
                label={t(FILTER_KEY[value])}
                selected={filter === value}
                onPress={() => setFilter(value)}
              />
            ))}
          </ScrollView>
        ) : null}
        {phase === 'session' || phase === 'loading' ? (
          <ProductListSkeleton label={t('seller.products.loading')} />
        ) : null}
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
        {phase === 'error' ? (
          <ErrorState
            title={t('seller.products.loadErrorTitle')}
            body={t('seller.products.loadErrorBody')}
            retryLabel={t('seller.products.retry')}
            onRetry={feed.reload}
          />
        ) : null}
        {deletedNotice ? <AppText tone="brand">{t('seller.delete.success')}</AppText> : null}
        {filterEmpty ? (
          <EmptyState
            title={t(filter === 'published' ? 'seller.products.emptyPublishedTitle' : 'seller.products.emptyPendingTitle')}
            body={t(filter === 'published' ? 'seller.products.emptyPublishedBody' : 'seller.products.emptyPendingBody')}
          />
        ) : null}
        {phase === 'empty' && !filterEmpty ? (
          <EmptyState
            title={t('seller.products.emptyTitle')}
            body={t('seller.products.emptyBody')}
            actionLabel={t('seller.draft.create')}
            onAction={() => navigation.navigate('CreateProduct')}
          />
        ) : null}
        {phase === 'list'
          ? visibleProducts.map((product) => {
              const status = sellerListStatus(product);
              const destination = sellerProductDestination(product);
              const note = sellerRejectionNote(product);
              const price = sellerPriceLine(product.priceFrom, product.priceCurrency, unitLabel(product.unit, t));
              const imageUrl = resolveMediaUrl(sellerProductImageUrl(product.images), apiBaseUrlFromEnv());
              const rowError = deleteFailure?.productId === product.id ? deleteFailure.failure : null;
              const harvestError = harvestFailure?.productId === product.id;
              return (
                <Card key={product.id} padded>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t('a11y.openProduct', { name: product.title })}. ${t('seller.products.views', { count: sellerMetricCount(product.viewCount) })}. ${t('seller.products.subscribers', { count: sellerMetricCount(product.watchCount) })}`}
                    onPress={() => navigation.navigate(destination.screen, destination.params)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
                  >
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <View
                      accessible={false}
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: radii.sm,
                        overflow: 'hidden',
                        backgroundColor: colors.neutralSoft,
                      }}
                    >
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={{ width: 88, height: 88 }}
                          contentFit="cover"
                          accessible={false}
                          transition={0}
                        />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, gap: spacing.xs, minWidth: 0 }}>
                      <AppText variant="bodyStrong" numberOfLines={2}>
                        {product.title}
                      </AppText>
                      {price ? (
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {price}
                        </AppText>
                      ) : null}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <Badge
                          label={t(STATUS_KEY[status])}
                          tone={STATUS_TONE[status]}
                          outline={STATUS_OUTLINE[status]}
                        />
                        <Badge
                          label={t(harvestBadgeKey(product.harvestStatus))}
                          tone={product.harvestStatus === 'soldOut' ? 'warning' : 'neutral'}
                          outline
                        />
                      </View>
                      {note ? (
                        <View
                          style={{
                            backgroundColor: colors.dangerSoft,
                            borderRadius: radii.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: spacing.xs,
                          }}
                        >
                          <AppText variant="caption" tone="danger">
                            {note}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
                      <Ionicons name="eye-outline" size={16} color={colors.muted} accessible={false} />
                      <AppText variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
                        {t('seller.products.views', { count: sellerMetricCount(product.viewCount) })}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
                      <Ionicons name="notifications-outline" size={16} color={colors.muted} accessible={false} />
                      <AppText variant="caption" tone="secondary" style={{ flexShrink: 1 }}>
                        {t('seller.products.subscribers', { count: sellerMetricCount(product.watchCount) })}
                      </AppText>
                    </View>
                  </View>
                  </Pressable>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      marginTop: spacing.md,
                    }}
                  >
                      <AppButton
                        label={
                          harvestId === product.id
                            ? t('seller.products.updateAvailabilityPending')
                            : t(UPDATE_AVAILABILITY_KEY)
                        }
                        variant="secondary"
                        disabled={harvestId != null}
                        onPress={() => setAvailabilitySheet(openAvailabilitySheet(product.id))}
                        style={{ flex: 1 }}
                      />
                      {canDeleteSellerProduct(product) ? (
                      <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('seller.delete.action')}
                          accessibilityState={{ disabled: deletingId === product.id, busy: deletingId === product.id }}
                          disabled={deletingId === product.id}
                          onPress={() => {
                            void onDelete(product);
                          }}
                          style={{
                            width: touchTarget,
                            height: touchTarget,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: deletingId === product.id ? 0.5 : 1,
                          }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={22}
                            color={colors.danger}
                            accessible={false}
                          />
                        </Pressable>
                      ) : null}
                  </View>
                  {rowError ? <AppText tone="danger">{t(DELETE_FAILURE_KEY[rowError])}</AppText> : null}
                  {harvestError ? (
                    <AppText tone="danger">{t('seller.products.updateAvailabilityFailed')}</AppText>
                  ) : null}
                </Card>
              );
            })
          : null}
      </ScrollView>
      <AvailabilitySheet
        product={feed.products.find((product) => product.id === availabilitySheet?.productId) ?? null}
        pending={harvestId != null}
        onClose={() => setAvailabilitySheet(null)}
        onSelect={(product, choice) => {
          void onChooseHarvest(product, choice);
        }}
      />
    </SafeAreaView>
  );
}

function AvailabilitySheet({
  product,
  pending,
  onClose,
  onSelect,
}: {
  product: SellerProduct | null;
  pending: boolean;
  onClose: () => void;
  onSelect: (product: SellerProduct, choice: HarvestChoice) => void;
}) {
  const { t } = useI18n();
  const { colors, spacing } = useTheme();

  return (
    <Modal visible={product != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.modal}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('product.galleryClose')}
          style={sheetStyles.backdrop}
          onPress={onClose}
        />
        <View style={[sheetStyles.sheet, { backgroundColor: colors.surface, padding: spacing.lg }]}>
          <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
            <AppText variant="title">{t(UPDATE_AVAILABILITY_KEY)}</AppText>
            {product
              ? HARVEST_STATUS_CHOICES.map((choice) => {
                  const selected = harvestChoiceSelected(product.harvestStatus, choice);
                  return (
                    <Pressable
                      key={choice ?? 'unset'}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: pending }}
                      disabled={pending}
                      onPress={() => onSelect(product, choice)}
                      style={{
                        minHeight: 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: spacing.sm,
                      }}
                    >
                      <AppText tone={selected ? 'brand' : 'ink'} style={{ flex: 1, flexShrink: 1 }}>
                        {t(harvestBadgeKey(choice))}
                      </AppText>
                      <AppText tone={selected ? 'brand' : 'muted'} accessible={false}>
                        {selected ? '✓' : ''}
                      </AppText>
                    </Pressable>
                  );
                })
              : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' },
});

function ProductListSkeleton({ label }: { label: string }) {
  const { colors, radii, spacing } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: spacing.md }}>
      {[0, 1, 2].map((row) => (
        <Animated.View
          key={row}
          style={{
            opacity,
            flexDirection: 'row',
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radii.md,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ width: 88, height: 88, borderRadius: radii.sm, backgroundColor: colors.skeleton }} />
          <View style={{ flex: 1, gap: spacing.sm, justifyContent: 'center' }}>
            <View style={{ height: 16, width: '72%', borderRadius: radii.sm, backgroundColor: colors.skeleton }} />
            <View style={{ height: 14, width: '40%', borderRadius: radii.sm, backgroundColor: colors.skeleton }} />
            <View style={{ height: 22, width: '56%', borderRadius: radii.sm, backgroundColor: colors.skeleton }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
