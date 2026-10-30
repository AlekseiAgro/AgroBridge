import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { apiBaseUrlFromEnv } from '../api/config';
import { resolveMediaUrl } from '../api/media-url';
import { useAuth } from '../auth/AuthProvider';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import type { DraftFailure, DraftGate } from '../seller/draft';
import type { SellerProductDetail } from '../seller/edit';
import {
  lastPublishedPhotoBlocked,
  photoSelection,
  readLocalPhotoMime,
  PRODUCT_IMAGE_MAX_COUNT,
  remainingPhotoSlots,
  submitProductPhotoDelete,
  submitProductPhotoPrimary,
  submitProductPhotoUpload,
  type PhotoIssue,
  type ProductPhotoFile,
  type SellerProductImage,
} from '../seller/photos';
import { deleteProductImage, setProductImagePrimary, uploadProductImage } from '../seller/photos-api';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { Badge } from './Badge';

type PhotoNotice = 'lastPublished' | PhotoIssue | 'permission' | 'pickerFailed' | DraftFailure;

const NOTICE_KEY: Record<PhotoNotice, MessageKey> = {
  lastPublished: 'seller.photos.lastPublished',
  unsupported: 'seller.photos.unsupported',
  tooLarge: 'seller.photos.tooLarge',
  maxReached: 'seller.photos.maxReached',
  missingFile: 'seller.photos.pickerFailed',
  permission: 'seller.photos.permission',
  pickerFailed: 'seller.photos.pickerFailed',
  validation: 'seller.photos.uploadFailed',
  unauthorized: 'seller.photos.uploadFailed',
  forbidden: 'seller.photos.uploadFailed',
  rateLimit: 'seller.photos.uploadFailed',
  network: 'seller.photos.uploadFailed',
  generic: 'seller.photos.uploadFailed',
};

type SellerProductPhotosProps = {
  productId: string | null;
  images: SellerProductImage[];
  isPublished: boolean;
  onUpdated: (product: SellerProductDetail) => void;
};

export function SellerProductPhotos({ productId, images, isPublished, onUpdated }: SellerProductPhotosProps) {
  const { t } = useI18n();
  const { colors, spacing, radii, touchTarget } = useTheme();
  const { api } = useAuth();
  const gate = useRef<DraftGate>({ pending: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<PhotoNotice | null>(null);
  const [noticeAction, setNoticeAction] = useState<'upload' | 'delete' | 'primary'>('upload');
  const [retryFile, setRetryFile] = useState<ProductPhotoFile | null>(null);
  const slots = remainingPhotoSlots(images.length);
  const publishedFloor = lastPublishedPhotoBlocked(isPublished, images.length);

  const uploadOne = async (file: ProductPhotoFile, currentCount: number): Promise<number | null> => {
    if (!productId) {
      return null;
    }
    const result = await submitProductPhotoUpload({
      productId,
      file,
      currentCount,
      gate: gate.current,
      upload: (id, next) => uploadProductImage(api, id, next),
      onPending: setBusy,
    });
    if (result.status === 'ignored') {
      return null;
    }
    if (result.status === 'invalid') {
      setNoticeAction('upload');
      setNotice(result.issue);
      setRetryFile(result.issue === 'maxReached' ? null : file);
      return null;
    }
    if (result.status === 'failed') {
      setNoticeAction('upload');
      setNotice(result.failure);
      setRetryFile(file);
      return null;
    }
    if (result.status === 'uploaded') {
      setNotice(null);
      setRetryFile(null);
      onUpdated(result.product);
      return result.product.images.length;
    }
    return null;
  };

  const pickPhotos = async () => {
    if (!productId || busy || slots <= 0) {
      return;
    }
    setNotice(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNoticeAction('upload');
        setNotice('permission');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: slots > 1,
        selectionLimit: slots,
        quality: 1,
      });
      if (result.canceled) {
        return;
      }
      const selection = photoSelection(images.length, result.assets.length);
      let count = images.length;
      let stopped = false;
      for (const asset of result.assets.slice(0, selection.take)) {
        const sniffed = await readLocalPhotoMime(asset.uri);
        const file: ProductPhotoFile = {
          uri: asset.uri,
          name: asset.fileName?.trim() || 'photo',
          mimeType: sniffed === undefined ? undefined : (sniffed ?? 'application/octet-stream'),
          fileSize: asset.fileSize,
        };
        const nextCount = await uploadOne(file, count);
        if (nextCount == null) {
          stopped = true;
          break;
        }
        count = nextCount;
      }
      if (selection.overflow && !stopped) {
        setNoticeAction('upload');
        setNotice('maxReached');
      }
    } catch {
      setNoticeAction('upload');
      setNotice('pickerFailed');
    }
  };

  const confirmDelete = (image: SellerProductImage) => {
    if (!productId || busy) {
      return;
    }
    if (publishedFloor) {
      setNoticeAction('delete');
      setNotice('lastPublished');
      return;
    }
    Alert.alert(t('seller.photos.deleteTitle'), t('seller.photos.deleteConfirm'), [
      { text: t('seller.photos.cancel'), style: 'cancel' },
      {
        text: t('seller.photos.remove'),
        style: 'destructive',
        onPress: () => {
          void remove(image);
        },
      },
    ]);
  };

  const remove = async (image: SellerProductImage) => {
    if (!productId) {
      return;
    }
    const result = await submitProductPhotoDelete({
      productId,
      imageId: image.id,
      isPublished,
      currentCount: images.length,
      gate: gate.current,
      remove: (id, imageId) => deleteProductImage(api, id, imageId),
      onPending: setBusy,
    });
    if (result.status === 'blocked') {
      setNoticeAction('delete');
      setNotice('lastPublished');
      return;
    }
    if (result.status === 'failed') {
      setNoticeAction('delete');
      setNotice(result.failure);
      return;
    }
    if (result.status === 'deleted') {
      setNotice(null);
      onUpdated(result.product);
    }
  };

  const makePrimary = async (image: SellerProductImage) => {
    if (!productId || busy || image.isPrimary) {
      return;
    }
    const result = await submitProductPhotoPrimary({
      productId,
      imageId: image.id,
      gate: gate.current,
      setPrimary: (id, imageId) => setProductImagePrimary(api, id, imageId),
      onPending: setBusy,
    });
    if (result.status === 'failed') {
      setNoticeAction('primary');
      setNotice(result.failure);
      return;
    }
    if (result.status === 'primary') {
      setNotice(null);
      onUpdated(result.product);
    }
  };

  const noticeText = notice ? t(NOTICE_KEY[notice], { max: PRODUCT_IMAGE_MAX_COUNT }) : null;
  const failureLabel =
    noticeAction === 'delete'
      ? t('seller.photos.deleteFailed')
      : noticeAction === 'primary'
        ? t('seller.photos.primaryFailed')
        : null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {t('seller.photos.title')}
        </AppText>
        {productId ? (
          <AppText variant="caption" tone="secondary">
            {images.length}/{PRODUCT_IMAGE_MAX_COUNT}
          </AppText>
        ) : null}
      </View>
      <AppText tone="secondary">{t('seller.photos.subtitle', { max: PRODUCT_IMAGE_MAX_COUNT })}</AppText>
      {productId ? null : <AppText tone="secondary">{t('seller.photos.saveFirst')}</AppText>}
      {productId && slots > 0 ? (
        <AppButton
          label={busy ? t('seller.photos.uploading') : t('seller.photos.add')}
          onPress={() => {
            void pickPhotos();
          }}
          loading={busy}
        />
      ) : null}
      {productId && slots === 0 ? (
        <AppText tone="secondary">{t('seller.photos.maxReached', { max: PRODUCT_IMAGE_MAX_COUNT })}</AppText>
      ) : null}
      {productId && images.length === 0 ? <AppText tone="secondary">{t('seller.photos.empty')}</AppText> : null}
      {publishedFloor ? <AppText tone="secondary">{t('seller.photos.lastPublished')}</AppText> : null}
      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {images.map((image) => {
            const uri = resolveMediaUrl(image.url, apiBaseUrlFromEnv());
            return (
              <View key={image.id} style={{ width: 112, gap: spacing.xs }}>
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={{ width: 112, height: 84, borderRadius: radii.md, backgroundColor: colors.line }}
                    contentFit="cover"
                    accessibilityLabel={image.isPrimary ? t('seller.photos.primary') : t('seller.photos.title')}
                  />
                ) : null}
                {image.isPrimary ? (
                  <Badge label={t('seller.photos.primary')} tone="success" />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('seller.photos.setPrimary')}
                    disabled={busy}
                    onPress={() => {
                      void makePrimary(image);
                    }}
                    style={{ minHeight: touchTarget, justifyContent: 'center' }}
                  >
                    <AppText tone="brand">{t('seller.photos.setPrimary')}</AppText>
                  </Pressable>
                )}
                {publishedFloor ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('seller.photos.remove')}
                    disabled={busy}
                    onPress={() => confirmDelete(image)}
                    style={{ minHeight: touchTarget, justifyContent: 'center' }}
                  >
                    <AppText tone="danger">{t('seller.photos.remove')}</AppText>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : null}
      {noticeText ? (
        <AppText tone="danger">
          {notice === 'validation' ||
          notice === 'unauthorized' ||
          notice === 'forbidden' ||
          notice === 'rateLimit' ||
          notice === 'network' ||
          notice === 'generic'
            ? (failureLabel ?? noticeText)
            : noticeText}
        </AppText>
      ) : null}
      {retryFile && productId ? (
        <AppButton
          label={t('seller.photos.retry')}
          variant="secondary"
          disabled={busy}
          onPress={() => {
            void uploadOne(retryFile, images.length);
          }}
        />
      ) : null}
    </View>
  );
}
