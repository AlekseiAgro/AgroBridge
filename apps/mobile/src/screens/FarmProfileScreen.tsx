import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrlFromEnv, joinApiUrl } from '../api/config';
import { resolveMediaUrl } from '../api/media-url';
import { isGeorgiaRegion } from '../catalog/categories';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppText } from '../components/AppText';
import { Badge, type BadgeTone } from '../components/Badge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { ErrorState } from '../components/ErrorState';
import { ScreenHeader } from '../components/ScreenHeader';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import type { DraftGate } from '../seller/draft';
import {
  checkCompanyRegistry,
  confirmFarmPhoneCode,
  createFarm,
  deleteFarmDocument,
  deleteFarmPhoto,
  fetchFarmVerification,
  fetchMyFarm,
  saveSellerType,
  sendFarmPhoneCode,
  setFarmPhotoPrimary,
  updateFarm,
  uploadFarmDocument,
  uploadFarmPhoto,
} from '../seller/farm-api';
import {
  approvedPrimaryDocumentLocked,
  emptyFarmForm,
  farmDocumentFilePath,
  farmFailure,
  farmFieldIssue,
  farmFormFromProfile,
  FARM_DOCUMENT_MAX_COUNT,
  FARM_PHOTO_MAX_COUNT,
  FARM_PRODUCER_TYPES,
  FARM_SELLER_TYPES,
  parseFarmProfile,
  parseFarmVerification,
  primaryKindForSeller,
  regionChoices,
  verificationSectionState,
  submitFarmDocumentDelete,
  submitFarmDocumentUpload,
  submitFarmPhotoDelete,
  submitFarmPhotoPrimary,
  submitFarmPhotoUpload,
  submitFarmSave,
  type FarmDocument,
  type FarmDocumentKind,
  type FarmFailure,
  type FarmFieldIssue,
  type FarmFormValues,
  type FarmMediaIssue,
  type FarmProfile,
  type FarmSellerType,
  type FarmVerificationStatus,
  type FarmVerification,
} from '../seller/farm';
import { readLocalPhotoMime, type ProductPhotoFile } from '../seller/photos';
import { useTheme } from '../theme/ThemeProvider';

const FIELD_KEY: Record<FarmFieldIssue, MessageKey> = {
  nameRequired: 'seller.farm.nameRequired',
  nameTooLong: 'seller.farm.nameTooLong',
  descriptionTooLong: 'seller.farm.descriptionTooLong',
  historyTooLong: 'seller.farm.historyTooLong',
  yearInvalid: 'seller.farm.yearInvalid',
  sizeInvalid: 'seller.farm.sizeInvalid',
  marketTooLong: 'seller.farm.marketTooLong',
  tooManyMarkets: 'seller.farm.tooManyMarkets',
};

const FAILURE_KEY: Record<FarmFailure, MessageKey> = {
  validation: 'seller.farm.saveFailed',
  unauthorized: 'seller.farm.saveFailed',
  forbidden: 'seller.farm.saveFailed',
  rateLimit: 'seller.farm.saveFailed',
  network: 'seller.farm.saveFailed',
  generic: 'seller.farm.saveFailed',
  notFound: 'seller.farm.notFound',
  conflict: 'seller.farm.conflict',
};

const VERIFY_TONE: Record<FarmVerificationStatus, BadgeTone> = {
  unverified: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const STATUS_BODY: Record<FarmVerificationStatus, MessageKey> = {
  unverified: 'seller.farm.unverifiedBody',
  pending: 'seller.farm.pendingBody',
  approved: 'seller.farm.approvedBody',
  rejected: 'seller.farm.rejectedBody',
};

const DOC_TONE: Record<FarmDocument['reviewStatus'], BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const MEDIA_KEY: Record<FarmMediaIssue, MessageKey> = {
  unsupported: 'seller.farm.fileUnsupported',
  tooLarge: 'seller.farm.fileTooLarge',
  maxReached: 'seller.farm.limitReached',
  missingFile: 'seller.farm.fileUnsupported',
  titleRequired: 'seller.farm.documentTitleRequired',
  deleteBlocked: 'seller.farm.deleteBlocked',
};

export function FarmProfileScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const { colors, spacing, radii, touchTarget } = useTheme();
  const { api } = useAuth();
  const gate = useRef<DraftGate>({ pending: false });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [verification, setVerification] = useState<FarmVerification | null>(null);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [values, setValues] = useState<FarmFormValues>(emptyFarmForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'secondary' | 'danger'>('secondary');
  const showNotice = (text: string, tone: 'secondary' | 'danger' = 'danger') => {
    setNotice(text);
    setNoticeTone(tone);
  };
  const [documentTitle, setDocumentTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [registryNumber, setRegistryNumber] = useState('');

  const applyVerification = useCallback((status: FarmVerification | null, failed: boolean) => {
    setVerification(status);
    setVerificationFailed(failed);
    if (status) {
      setRegistryNumber(status.companyRegistrationNumber ?? '');
      setPhone(status.phone ?? '');
    }
  }, []);

  const loadVerification = useCallback(async () => {
    try {
      const status = parseFarmVerification(await fetchFarmVerification(api));
      applyVerification(status, !status);
    } catch {
      applyVerification(null, true);
    }
  }, [api, applyVerification]);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const next = parseFarmProfile(await fetchMyFarm(api));
      setFarm(next);
      setValues(next ? farmFormFromProfile(next) : emptyFarmForm());
      if (next) {
        await loadVerification();
      } else {
        applyVerification(null, false);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [api, applyVerification, loadVerification]);

  useEffect(() => {
    let cancelled = false;
    fetchMyFarm(api)
      .then(async (body) => {
        if (cancelled) return;
        const next = parseFarmProfile(body);
        setFarm(next);
        setValues(next ? farmFormFromProfile(next) : emptyFarmForm());
        if (!next) {
          applyVerification(null, false);
          return;
        }
        try {
          const status = parseFarmVerification(await fetchFarmVerification(api));
          if (cancelled) return;
          applyVerification(status, !status);
        } catch {
          if (!cancelled) applyVerification(null, true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, applyVerification]);

  const setField = <K extends keyof FarmFormValues>(key: K, value: FarmFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const onSave = async () => {
    const issue = farmFieldIssue(values);
    if (issue) {
      showNotice(t(FIELD_KEY[issue]));
      return;
    }
    const result = await submitFarmSave({
      mode: farm ? 'edit' : 'create',
      values,
      gate: gate.current,
      save: (body) => (farm ? updateFarm(api, body) : createFarm(api, body)),
      onPending: setBusy,
    });
    if (result.status === 'invalid') {
      showNotice(t(FIELD_KEY[result.issue]));
      return;
    }
    if (result.status === 'failed') {
      showNotice(t(FAILURE_KEY[result.failure]));
      if (result.failure === 'conflict') {
        await load();
      }
      return;
    }
    if (result.status === 'saved') {
      setFarm(result.farm);
      setValues(farmFormFromProfile(result.farm));
      showNotice(t(farm ? 'seller.farm.updated' : 'seller.farm.created'), 'secondary');
      if (!farm) {
        await loadVerification();
      }
    }
  };

  const applyFarm = (next: FarmProfile) => {
    setFarm(next);
  };

  const pickPhoto = async () => {
    if (!farm || busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showNotice(t('seller.farm.fileUnsupported'));
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const sniffed = asset.mimeType ? null : await readLocalPhotoMime(asset.uri);
    const selected: ProductPhotoFile = {
      uri: asset.uri,
      name: asset.fileName ?? 'farm-photo.jpg',
      mimeType: asset.mimeType ?? sniffed,
      fileSize: asset.fileSize,
    };
    const result = await submitFarmPhotoUpload({
      file: selected,
      currentCount: farm.photos.length,
      gate: gate.current,
      upload: (file) => uploadFarmPhoto(api, file),
      onPending: setBusy,
    });
    if (result.status === 'saved') applyFarm(result.value);
    else if (result.status === 'invalid') showNotice(t(MEDIA_KEY[result.issue]));
    else if (result.status === 'failed') showNotice(t(FAILURE_KEY[result.failure]));
  };

  const onDeletePhoto = (photoId: string) => {
    if (!farm) return;
    void submitFarmPhotoDelete({
      gate: gate.current,
      ask: () =>
        new Promise((resolve) => {
          Alert.alert(t('seller.farm.deletePhoto'), t('seller.farm.deletePhotoConfirm'), [
            { text: t('seller.delete.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
            { text: t('seller.farm.deletePhoto'), style: 'destructive', onPress: () => resolve('confirm') },
          ]);
        }),
      remove: () => deleteFarmPhoto(api, photoId),
      onPending: setBusy,
    }).then((result) => {
      if (result.status === 'saved') applyFarm(result.value);
      else if (result.status === 'failed') showNotice(t(FAILURE_KEY[result.failure]));
    });
  };

  const onPrimary = (photoId: string) => {
    void submitFarmPhotoPrimary({
      gate: gate.current,
      setPrimary: () => setFarmPhotoPrimary(api, photoId),
      onPending: setBusy,
    }).then((result) => {
      if (result.status === 'saved') applyFarm(result.value);
      else if (result.status === 'failed') showNotice(t(FAILURE_KEY[result.failure]));
    });
  };

  const refreshDocuments = async () => {
    const next = parseFarmProfile(await fetchMyFarm(api));
    if (next) setFarm(next);
    await loadVerification();
  };

  const uploadDocument = async (kind: FarmDocumentKind, title: string) => {
    if (!farm) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const selected: ProductPhotoFile = {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      fileSize: asset.size,
    };
    const resolvedTitle = title.trim() || asset.name;
    const result = await submitFarmDocumentUpload({
      file: selected,
      title: resolvedTitle,
      kind,
      currentCount: farm.documents.length,
      gate: gate.current,
      upload: () => uploadFarmDocument(api, { title: resolvedTitle, kind, file: selected }),
      onPending: setBusy,
    });
    if (result.status === 'saved') {
      setDocumentTitle('');
      await refreshDocuments();
      showNotice(
        t(result.value.submitsReview ? 'seller.farm.submitted' : 'seller.farm.documentSaved'),
        'secondary',
      );
      return;
    }
    if (result.status === 'invalid') showNotice(t(MEDIA_KEY[result.issue]));
    if (result.status === 'failed') showNotice(t(FAILURE_KEY[result.failure]));
  };

  const onDeleteDocument = (document: FarmDocument) => {
    if (!farm) return;
    void submitFarmDocumentDelete({
      locked: approvedPrimaryDocumentLocked(farm.verificationStatus, document),
      gate: gate.current,
      ask: () =>
        new Promise((resolve) => {
          Alert.alert(t('seller.farm.deleteDocument'), t('seller.farm.deleteDocumentConfirm'), [
            { text: t('seller.delete.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
            {
              text: t('seller.farm.deleteDocument'),
              style: 'destructive',
              onPress: () => resolve('confirm'),
            },
          ]);
        }),
      remove: () => deleteFarmDocument(api, document.id),
      onPending: setBusy,
    }).then(async (result) => {
      if (result.status === 'saved') await refreshDocuments();
      else if (result.status === 'invalid') showNotice(t(MEDIA_KEY[result.issue]));
      else if (result.status === 'failed') showNotice(t(FAILURE_KEY[result.failure]));
    });
  };

  const onOpenDocument = async (document: FarmDocument) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        showNotice(t('seller.farm.openFailed'));
        return;
      }
      const destination = new File(Paths.cache, document.fileName || `${document.id}.bin`);
      const downloaded = await File.downloadFileAsync(
        joinApiUrl(apiBaseUrlFromEnv(), farmDocumentFilePath(document.id)),
        destination,
        { headers: await api.authHeaders(), idempotent: true },
      );
      await Sharing.shareAsync(downloaded.uri);
    } catch {
      showNotice(t('seller.farm.openFailed'));
    }
  };

  const onSellerType = async (sellerType: FarmSellerType) => {
    if (verification?.sellerTypeLocked || busy) return;
    setBusy(true);
    try {
      const next = parseFarmVerification(await saveSellerType(api, sellerType));
      if (next) setVerification(next);
    } catch (error) {
      showNotice(t(FAILURE_KEY[farmFailure(error)]));
    } finally {
      setBusy(false);
    }
  };

  const onRegistry = async () => {
    setBusy(true);
    try {
      const next = parseFarmVerification(await checkCompanyRegistry(api, registryNumber.trim()));
      if (next) setVerification(next);
    } catch (error) {
      showNotice(t(FAILURE_KEY[farmFailure(error)]));
    } finally {
      setBusy(false);
    }
  };

  const onSendPhone = async () => {
    setBusy(true);
    try {
      await sendFarmPhoneCode(api, phone.trim());
      showNotice(t('seller.farm.codeSent'), 'secondary');
    } catch (error) {
      showNotice(t(FAILURE_KEY[farmFailure(error)]));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmPhone = async () => {
    setBusy(true);
    try {
      const next = parseFarmVerification(await confirmFarmPhoneCode(api, phoneCode.trim()));
      if (next) setVerification(next);
      showNotice(t('seller.farm.phoneVerified'), 'secondary');
    } catch (error) {
      showNotice(t(FAILURE_KEY[farmFailure(error)]));
    } finally {
      setBusy(false);
    }
  };

  const verificationStatus = verification?.farmVerificationStatus ?? farm?.verificationStatus ?? null;
  const sectionRule = {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.md,
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('seller.farm.title')} backLabel={t('common.back')} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <FarmFormSkeleton label={t('seller.farm.title')} />
        </View>
      ) : loadFailed ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <ErrorState
            title={t('seller.farm.loadFailed')}
            body={t('seller.products.loadErrorBody')}
            retryLabel={t('seller.products.retry')}
            onRetry={() => void load()}
          />
        </View>
      ) : (
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
          <View style={{ gap: spacing.sm }}>
            <AppText variant="title">{farm ? farm.name : t('seller.farm.createTitle')}</AppText>
            {farm && verificationStatus ? (
              <Badge
                label={t(`seller.farm.status.${verificationStatus}`)}
                tone={VERIFY_TONE[verificationStatus]}
              />
            ) : (
              <View style={{ gap: spacing.xs }}>
                <AppText tone="secondary">{t('seller.farm.empty')}</AppText>
                <AppText tone="secondary">{t('seller.farm.emptyBody')}</AppText>
              </View>
            )}
          </View>
          {notice ? <AppText tone={noticeTone}>{notice}</AppText> : null}

          {farm ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                  <AppText variant="bodyStrong" style={{ flex: 1 }}>
                    {t('seller.farm.photos')}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    {farm.photos.length}/{FARM_PHOTO_MAX_COUNT}
                  </AppText>
                </View>
                <AppText tone="secondary">{t('seller.farm.photoLimit', { max: String(FARM_PHOTO_MAX_COUNT) })}</AppText>
                {farm.photos.length > 0 ? (
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0 }}
                    contentContainerStyle={{ gap: spacing.sm }}
                  >
                    {farm.photos.map((photo) => (
                      <View key={photo.id} style={{ width: 148, gap: spacing.xs }}>
                        <Image
                          source={{ uri: resolveMediaUrl(photo.url, apiBaseUrlFromEnv()) ?? undefined }}
                          style={{ width: 148, height: 112, borderRadius: radii.md, backgroundColor: colors.neutralSoft }}
                          contentFit="cover"
                          accessibilityLabel={photo.isPrimary ? t('seller.farm.primary') : t('seller.farm.photos')}
                        />
                        {photo.isPrimary ? (
                          <Badge label={t('seller.farm.primary')} tone="success" />
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('seller.farm.setPrimary')}
                            onPress={() => onPrimary(photo.id)}
                            style={{ minHeight: touchTarget, justifyContent: 'center' }}
                          >
                            <AppText tone="brand">{t('seller.farm.setPrimary')}</AppText>
                          </Pressable>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('seller.farm.deletePhoto')}
                          onPress={() => onDeletePhoto(photo.id)}
                          style={{ minHeight: touchTarget, justifyContent: 'center' }}
                        >
                          <AppText tone="danger">{t('seller.farm.deletePhoto')}</AppText>
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
                {farm.photos.length < FARM_PHOTO_MAX_COUNT ? (
                  <AppButton label={t('seller.farm.addPhoto')} variant="secondary" onPress={() => void pickPhoto()} />
                ) : null}
              </View>
            </Card>
          ) : null}

          <Card padded>
            <View style={{ gap: spacing.md }}>
            <AppText variant="bodyStrong">{t('seller.farm.about')}</AppText>
            <Field
              label={t('seller.farm.name')}
              hint={t('seller.farm.required')}
              value={values.name}
              onChangeText={(value) => setField('name', value)}
            />
            <AppText variant="label">{t('seller.farm.region')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {regionChoices(values.region).map((region) => (
                <Chip
                  key={region}
                  label={isGeorgiaRegion(region) ? t(`regions.${region}`) : region}
                  selected={values.region === region}
                  onPress={() => setField('region', values.region === region ? '' : region)}
                />
              ))}
            </View>
            <Field
              label={t('seller.farm.description')}
              value={values.description}
              onChangeText={(value) => setField('description', value)}
              multiline
            />
            <View style={sectionRule}>
              <AppText variant="bodyStrong">{t('seller.farm.details')}</AppText>
              <Field
                label={t('seller.farm.foundedYear')}
                value={values.foundedYear}
                onChangeText={(value) => setField('foundedYear', value)}
                keyboardType="number-pad"
              />
              <Field
                label={t('seller.farm.size')}
                value={values.farmSizeHectares}
                onChangeText={(value) => setField('farmSizeHectares', value)}
                keyboardType="decimal-pad"
              />
              {farm && (farm.foundedYear != null || farm.farmSizeHectares != null) ? (
                <AppText variant="caption" tone="secondary">
                  {t('seller.farm.keptValue')}
                </AppText>
              ) : null}
              <AppText variant="label">{t('seller.farm.producerType')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {FARM_PRODUCER_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={t(`seller.farm.producer.${type}`)}
                  selected={values.producerType === type}
                  onPress={() => setField('producerType', values.producerType === type ? '' : type)}
                />
              ))}
            </View>
            </View>
            <View style={sectionRule}>
              <Field
                label={t('seller.farm.exportMarkets')}
                value={values.exportMarkets}
                onChangeText={(value) => setField('exportMarkets', value)}
              />
              <AppText variant="caption" tone="secondary">
                {t('seller.farm.marketsHint')}
              </AppText>
              <Field
                label={t('seller.farm.history')}
                value={values.history}
                onChangeText={(value) => setField('history', value)}
                multiline
                minHeight={160}
              />
            </View>
            {farm?.ownershipType && !farm.producerType ? (
              <AppText tone="secondary">{t('seller.farm.legacyOwnership', { value: farm.ownershipType })}</AppText>
            ) : null}
            <View style={sectionRule}>
              <AppButton
                label={busy ? t('seller.farm.saving') : farm ? t('seller.farm.save') : t('seller.farm.createTitle')}
                onPress={() => void onSave()}
                loading={busy}
              />
            </View>
            </View>
          </Card>

          {verificationSectionState({
            hasFarm: Boolean(farm),
            verification,
            failed: verificationFailed,
          }) === 'unavailable' ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText variant="bodyStrong">{t('seller.farm.verification')}</AppText>
                <AppText tone="secondary">{t('seller.farm.verificationUnavailable')}</AppText>
                <AppButton
                  label={t('seller.products.retry')}
                  variant="secondary"
                  onPress={() => void loadVerification()}
                />
              </View>
            </Card>
          ) : null}

          {farm && verification ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText variant="bodyStrong">{t('seller.farm.verification')}</AppText>
                <Badge
                  label={t(`seller.farm.status.${verification.farmVerificationStatus}`)}
                  tone={VERIFY_TONE[verification.farmVerificationStatus]}
                />
                <AppText tone="secondary">{t(STATUS_BODY[verification.farmVerificationStatus])}</AppText>
                {verification.verificationReasonCode ? (
                  <AppText tone={verification.farmVerificationStatus === 'rejected' ? 'danger' : 'secondary'}>
                    {t(`seller.farm.reason.${verification.verificationReasonCode}`)}
                  </AppText>
                ) : null}
                {verification.moderatorComment ? (
                  <View
                    style={{
                      backgroundColor: colors.dangerSoft,
                      borderRadius: radii.sm,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                    }}
                  >
                    <AppText variant="caption" tone="danger">
                      {t('seller.farm.moderatorComment', { note: verification.moderatorComment })}
                    </AppText>
                  </View>
                ) : null}
                <AppText variant="label">{t('seller.farm.sellerType')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {FARM_SELLER_TYPES.map((type) => (
                    <Chip
                      key={type}
                      label={t(`seller.farm.sellerType.${type}`)}
                      selected={verification.sellerType === type}
                      onPress={
                        verification.sellerTypeLocked || busy ? undefined : () => void onSellerType(type)
                      }
                    />
                  ))}
                </View>
                {!verification.phoneVerified ? (
                  <View style={{ gap: spacing.sm }}>
                    <Field label={t('seller.farm.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                    <AppButton label={t('seller.farm.sendCode')} variant="secondary" onPress={() => void onSendPhone()} />
                    <Field
                      label={t('seller.farm.code')}
                      value={phoneCode}
                      onChangeText={setPhoneCode}
                      keyboardType="number-pad"
                    />
                    <AppButton label={t('seller.farm.confirmCode')} variant="secondary" onPress={() => void onConfirmPhone()} />
                  </View>
                ) : verification.phone ? (
                  <AppText tone="secondary">{t('seller.farm.phoneVerified')}</AppText>
                ) : null}
                {verification.phoneVerified && verification.phone ? (
                  <AppText tone="secondary">{verification.phone}</AppText>
                ) : null}
                {verification.path === 'company' ? (
                  <View style={{ gap: spacing.sm }}>
                    <Field
                      label={t('seller.farm.companyNumber')}
                      value={registryNumber}
                      onChangeText={setRegistryNumber}
                    />
                    <AppButton label={t('seller.farm.checkRegistry')} variant="secondary" onPress={() => void onRegistry()} />
                    {verification.companyRegistryName ? <AppText>{verification.companyRegistryName}</AppText> : null}
                  </View>
                ) : null}
                {primaryKindForSeller(verification.sellerType) ? (
                  <AppButton
                    label={
                      verification.sellerType === 'company'
                        ? t('seller.farm.uploadRegistration')
                        : t('seller.farm.uploadId')
                    }
                    variant={
                      verification.farmVerificationStatus === 'unverified' ||
                      verification.farmVerificationStatus === 'rejected'
                        ? 'primary'
                        : 'secondary'
                    }
                    onPress={() =>
                      void uploadDocument(
                        primaryKindForSeller(verification.sellerType) ?? 'other',
                        verification.sellerType === 'company'
                          ? t('seller.farm.kind.businessRegistration')
                          : t('seller.farm.kind.idCard'),
                      )
                    }
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          {farm ? (
            <Card padded>
              <View style={{ gap: spacing.md }}>
                <AppText variant="bodyStrong">{t('seller.farm.documents')}</AppText>
                {farm.documents.map((document) => {
                  const locked = approvedPrimaryDocumentLocked(
                    verification?.farmVerificationStatus ?? farm.verificationStatus,
                    document,
                  );
                  return (
                    <View
                      key={document.id}
                      style={{
                        gap: spacing.xs,
                        paddingTop: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.line,
                      }}
                    >
                      <AppText variant="bodyStrong">{document.title}</AppText>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <Badge label={t(`seller.farm.kind.${document.kind}`)} />
                        <Badge
                          label={t(`seller.farm.doc.${document.reviewStatus}`)}
                          tone={DOC_TONE[document.reviewStatus]}
                        />
                      </View>
                      {document.reviewNote ? (
                        <AppText tone="secondary">
                          {t('seller.farm.reviewNote', { note: document.reviewNote })}
                        </AppText>
                      ) : null}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <View style={{ flexGrow: 1, flexBasis: 140 }}>
                          <AppButton
                            label={t('seller.farm.open')}
                            variant="secondary"
                            onPress={() => void onOpenDocument(document)}
                          />
                        </View>
                      </View>
                      {locked ? (
                        <AppText variant="caption" tone="secondary">
                          {t('seller.farm.deleteBlocked')}
                        </AppText>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('seller.farm.deleteDocument')}
                          onPress={() => onDeleteDocument(document)}
                          style={{
                            minHeight: touchTarget,
                            justifyContent: 'center',
                            paddingHorizontal: spacing.md,
                            borderRadius: radii.sm,
                            backgroundColor: colors.dangerSoft,
                          }}
                        >
                          <AppText tone="danger">{t('seller.farm.deleteDocument')}</AppText>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {farm.documents.length < FARM_DOCUMENT_MAX_COUNT ? (
                  <View style={{ gap: spacing.sm }}>
                    <Field
                      label={t('seller.farm.documentTitle')}
                      value={documentTitle}
                      onChangeText={setDocumentTitle}
                    />
                    <AppButton
                      label={t('seller.farm.addDocument')}
                      variant="secondary"
                      onPress={() => void uploadDocument('other', documentTitle)}
                    />
                  </View>
                ) : (
                  <AppText tone="secondary">{t('seller.farm.limitReached')}</AppText>
                )}
              </View>
            </Card>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FarmFormSkeleton({ label }: { label: string }) {
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
    <Animated.View accessibilityRole="progressbar" accessibilityLabel={label} style={{ opacity, gap: spacing.md }}>
      <View style={{ height: 24, width: '46%', borderRadius: radii.sm, backgroundColor: colors.skeleton }} />
      <View style={{ height: 88, borderRadius: radii.md, backgroundColor: colors.skeleton }} />
      <View style={{ height: 44, borderRadius: radii.md, backgroundColor: colors.skeleton }} />
      <View style={{ height: 44, width: '72%', borderRadius: radii.md, backgroundColor: colors.skeleton }} />
      <View style={{ height: 120, borderRadius: radii.md, backgroundColor: colors.skeleton }} />
    </Animated.View>
  );
}

function Field({
  label,
  hint,
  value,
  onChangeText,
  multiline,
  minHeight,
  keyboardType,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  minHeight?: number;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'phone-pad';
}) {
  const { colors, spacing, radii, touchTarget } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm }}>
        <AppText variant="label" style={{ flexShrink: 1 }}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        inputMode={
          keyboardType === 'decimal-pad' ? 'decimal' : keyboardType === 'number-pad' ? 'numeric' : undefined
        }
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={{
          minHeight: multiline ? (minHeight ?? 120) : touchTarget,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.ink,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
