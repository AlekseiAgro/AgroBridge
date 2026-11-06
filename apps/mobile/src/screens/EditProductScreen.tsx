import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Badge, type BadgeTone } from '../components/Badge';
import { Card } from '../components/Card';
import { ErrorState } from '../components/ErrorState';
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
  beginProductDelete,
  destinationAfterDelete,
  type DeleteFailure,
} from '../seller/delete';
import { askToDeleteProduct } from '../seller/delete-alert';
import type { DraftFailure, DraftGate } from '../seller/draft';
import {
  editLoadFailure,
  editPhase,
  editRejectionNote,
  publishActionKind,
  publishActionVisible,
  publishStatusNote,
  routeAfterEdit,
  sellerFormFromDetail,
  submitProductEdit,
  submitProductPublish,
  type EditIssue,
  type EditLoadFailure,
  type PublishBlock,
  type PublishFailure,
  type SellerProductDetail,
} from '../seller/edit';
import { productAfterMediaChange } from '../seller/photos';
import { EMPTY_PRODUCT_FORM, type SellerProductFormValues } from '../seller/product-form';
import { sellerListStatus, shouldLoadMyProducts, type SellerListStatus } from '../seller/products';
import { deleteSellerProduct, getSellerProduct, updateSellerProduct } from '../seller/products-api';
import { useTheme } from '../theme/ThemeProvider';

const ISSUE_KEY: Record<EditIssue, MessageKey> = {
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
  publishedIncomplete: 'seller.edit.publishedIncomplete',
};

function isPublishListingBlock(block: PublishBlock): block is Exclude<PublishBlock, EditIssue> {
  return (
    block === 'title' ||
    block === 'category' ||
    block === 'unit' ||
    block === 'priceFrom' ||
    block === 'priceCurrency' ||
    block === 'photoRequired'
  );
}

const PUBLISH_BLOCK_KEY: Record<Exclude<PublishBlock, EditIssue>, MessageKey> = {
  title: 'seller.publish.title',
  category: 'seller.publish.category',
  unit: 'seller.publish.unit',
  priceFrom: 'seller.publish.price',
  priceCurrency: 'seller.publish.currency',
  photoRequired: 'seller.publish.photo',
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

const PUBLISH_FAILURE_KEY: Record<PublishFailure, MessageKey> = {
  validation: 'seller.publish.failed',
  unauthorized: 'seller.publish.unauthorized',
  forbidden: 'seller.publish.forbidden',
  rateLimit: 'seller.publish.failed',
  network: 'seller.publish.network',
  generic: 'seller.publish.failed',
  notFound: 'seller.publish.notFound',
};

const FAILURE_KEY: Record<DraftFailure, MessageKey> = {
  validation: 'seller.edit.failed',
  unauthorized: 'seller.edit.failed',
  forbidden: 'seller.edit.failed',
  rateLimit: 'seller.edit.failed',
  network: 'seller.edit.failed',
  generic: 'seller.edit.failed',
};

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

export function EditProductScreen() {
  const { t } = useI18n();
  const { colors, spacing, touchTarget } = useTheme();
  const { api, status, user, profileUnavailable } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditProduct'>>();
  const productId = route.params.productId;
  const gate = useRef<DraftGate>({ pending: false });
  const [reloadToken, setReloadToken] = useState(0);
  const canLoad = shouldLoadMyProducts({ user, profileUnavailable });
  const requestKey = `${productId}:${reloadToken}:${canLoad ? 'load' : 'skip'}`;
  const [seenKey, setSeenKey] = useState(requestKey);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'notFound' | 'error'>(
    canLoad ? 'loading' : 'idle',
  );
  const [loadFailure, setLoadFailure] = useState<EditLoadFailure | null>(null);
  const [loaded, setLoaded] = useState<SellerProductDetail | null>(null);
  const [values, setValues] = useState<SellerProductFormValues>(EMPTY_PRODUCT_FORM);
  const [pending, setPending] = useState(false);
  const [issue, setIssue] = useState<EditIssue | null>(null);
  const [failure, setFailure] = useState<DraftFailure | null>(null);
  const [intent, setIntent] = useState<'save' | 'publish' | null>(null);
  const [publishBlocksShown, setPublishBlocksShown] = useState<PublishBlock[]>([]);
  const [publishFailure, setPublishFailure] = useState<PublishFailure | null>(null);
  const [publishSent, setPublishSent] = useState(false);
  const [deleteFailure, setDeleteFailure] = useState<DeleteFailure | null>(null);
  const [deleting, setDeleting] = useState(false);
  if (seenKey !== requestKey) {
    setSeenKey(requestKey);
    setLoaded(null);
    setValues(EMPTY_PRODUCT_FORM);
    setIssue(null);
    setFailure(null);
    setIntent(null);
    setPublishBlocksShown([]);
    setPublishFailure(null);
    setPublishSent(false);
    setDeleteFailure(null);
    setDeleting(false);
    setLoadFailure(null);
    setLoadStatus(canLoad ? 'loading' : 'idle');
  }
  const phase = editPhase({
    authStatus: status === 'loading' ? 'loading' : status,
    user,
    profileUnavailable,
    loadStatus,
  });

  useEffect(() => {
    if (!canLoad) {
      return;
    }
    let cancelled = false;
    getSellerProduct(api, productId)
      .then((product) => {
        if (cancelled) {
          return;
        }
        setLoaded(product);
        setValues(sellerFormFromDetail(product));
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const next = editLoadFailure(error);
        setLoadFailure(next);
        setLoadStatus(next === 'notFound' ? 'notFound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, canLoad, productId, reloadToken]);

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MyProducts');
  };

  const onSubmit = async () => {
    if (!loaded || phase !== 'form') {
      return;
    }
    setIntent('save');
    setPublishBlocksShown([]);
    setPublishFailure(null);
    setPublishSent(false);
    const result = await submitProductEdit({
      values,
      loaded,
      gate: gate.current,
      update: (body) => updateSellerProduct(api, loaded.id, body),
      onPending: setPending,
    });
    setIntent(null);
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
    if (routeAfterEdit(result.status) === 'MyProducts') {
      leave();
    }
  };

  const onPublish = async () => {
    if (!loaded || phase !== 'form') {
      return;
    }
    setIntent('publish');
    setIssue(null);
    setFailure(null);
    setPublishSent(false);
    const result = await submitProductPublish({
      values,
      loaded,
      gate: gate.current,
      update: (body) => updateSellerProduct(api, loaded.id, body),
      onPending: setPending,
    });
    setIntent(null);
    if (result.status === 'ignored') {
      return;
    }
    if (result.status === 'invalid') {
      setPublishBlocksShown(result.blocks);
      setPublishFailure(null);
      return;
    }
    if (result.status === 'failed') {
      setPublishBlocksShown([]);
      setPublishFailure(result.failure);
      return;
    }
    setPublishBlocksShown([]);
    setPublishFailure(null);
    setLoaded(result.product);
    setValues(sellerFormFromDetail(result.product));
    setPublishSent(true);
  };

  const onDelete = async () => {
    if (!loaded || phase !== 'form') {
      return;
    }
    setDeleteFailure(null);
    const result = await beginProductDelete({
      product: loaded,
      ask: (prompt) =>
        askToDeleteProduct(prompt, {
          title: t('seller.delete.title'),
          body: t('seller.delete.body', { name: prompt.productTitle }),
          cancel: t('seller.delete.cancel'),
          confirm: t('seller.delete.confirm'),
        }),
      gate: gate.current,
      remove: (productId) => deleteSellerProduct(api, productId),
      onPending: setDeleting,
    });
    if (result.status === 'cancelled' || result.status === 'ignored') {
      return;
    }
    if (result.status === 'failed') {
      setDeleteFailure(result.failure);
      return;
    }
    if (destinationAfterDelete('editor') === 'MyProducts') {
      navigation.navigate('MyProducts');
    }
  };

  const note = loaded ? editRejectionNote(loaded) : null;
  const statusLabel = loaded ? sellerListStatus(loaded) : null;

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
          <ScreenHeader title={t('seller.edit.title')} backLabel={t('common.back')} onBack={leave} />
          {phase === 'session' || phase === 'loading' ? (
            <LoadingSkeleton accessibilityLabel={t('seller.edit.loading')} />
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
          {phase === 'notFound' ? (
            <ErrorState
              title={t('seller.edit.notFoundTitle')}
              body={t('seller.edit.notFoundBody')}
              retryLabel={t('seller.products.retry')}
              onRetry={() => setReloadToken((current) => current + 1)}
            />
          ) : null}
          {phase === 'error' ? (
            <ErrorState
              title={loadFailure === 'forbidden' ? t('seller.edit.forbidden') : t('seller.edit.loadErrorTitle')}
              body={t('seller.edit.loadErrorBody')}
              retryLabel={t('seller.products.retry')}
              onRetry={() => setReloadToken((current) => current + 1)}
            />
          ) : null}
          {phase === 'form' && loaded && statusLabel ? (
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Badge label={t(STATUS_KEY[statusLabel])} tone={STATUS_TONE[statusLabel]} />
                {loaded.harvestStatus === 'soldOut' ? (
                  <Badge label={t('seller.draft.harvestStatus.soldOut')} tone="warning" />
                ) : null}
              </View>
              {note ? (
                <AppText>
                  {t('seller.edit.rejectionNote')}: {note}
                </AppText>
              ) : null}
              <SellerProductForm
                values={values}
                onChange={(next) => {
                  setValues(next);
                  setPublishBlocksShown([]);
                  setPublishFailure(null);
                  setPublishSent(false);
                }}
                pending={pending}
                issueText={issue ? t(ISSUE_KEY[issue]) : null}
                failureText={failure ? t(FAILURE_KEY[failure]) : null}
                saveLabel={intent === 'save' && pending ? t('seller.edit.saving') : t('seller.edit.save')}
                saveLoading={intent === 'save' && pending}
                onSubmit={() => {
                  void onSubmit();
                }}
                publishLabel={
                  publishActionVisible(loaded)
                    ? intent === 'publish' && pending
                      ? t('seller.publish.publishing')
                      : t(
                          publishActionKind(loaded) === 'resubmit'
                            ? 'seller.publish.resubmit'
                            : 'seller.publish.action',
                        )
                    : null
                }
                onPublish={() => {
                  void onPublish();
                }}
                publishLoading={intent === 'publish' && pending}
                publishHint={publishActionVisible(loaded) ? t('seller.publish.hint') : null}
                statusNote={
                  publishStatusNote(loaded) === 'pending'
                    ? t('seller.publish.pending')
                    : publishStatusNote(loaded) === 'live'
                      ? t('seller.publish.live')
                      : null
                }
                successText={publishSent ? t('seller.publish.sent') : null}
                publishIssueTexts={publishBlocksShown.map((block) =>
                  isPublishListingBlock(block) ? t(PUBLISH_BLOCK_KEY[block]) : t(ISSUE_KEY[block]),
                )}
                publishFailureText={publishFailure ? t(PUBLISH_FAILURE_KEY[publishFailure]) : null}
                media={
                  <View style={{ gap: spacing.md }}>
                    <SellerProductPhotos
                      productId={loaded.id}
                      images={loaded.images}
                      isPublished={loaded.isPublished}
                      onUpdated={(product) => {
                        setLoaded((current) => (current ? productAfterMediaChange(current, product) : product));
                      }}
                    />
                    <SellerProductVideoSection
                      productId={loaded.id}
                      videos={loaded.videos}
                      onUpdated={(product) => {
                        setLoaded((current) => (current ? productAfterMediaChange(current, product) : product));
                      }}
                    />
                    <SellerProductCertificates
                      productId={loaded.id}
                      certificates={loaded.certificates}
                      onUpdated={(product) => {
                        setLoaded((current) => (current ? productAfterMediaChange(current, product) : product));
                      }}
                    />
                  </View>
                }
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('seller.delete.action')}
                disabled={deleting}
                onPress={() => {
                  void onDelete();
                }}
                style={{
                  marginTop: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  borderRadius: spacing.sm,
                  backgroundColor: colors.dangerSoft,
                  minHeight: touchTarget,
                  justifyContent: 'center',
                }}
              >
                <AppText tone="danger">
                  {deleting ? t('seller.delete.pending') : t('seller.delete.action')}
                </AppText>
              </Pressable>
              {deleteFailure ? <AppText tone="danger">{t(DELETE_FAILURE_KEY[deleteFailure])}</AppText> : null}
            </View>
          ) : null}
        </ScrollView>
    </SafeAreaView>
  );
}
