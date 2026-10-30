import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { apiBaseUrlFromEnv } from '../api/config';
import { useAuth } from '../auth/AuthProvider';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import type { DraftGate } from '../seller/draft';
import type { SellerProductDetail } from '../seller/edit';
import { deleteProductVideo, uploadProductVideo } from '../seller/video-api';
import {
  classifyVideoBytes,
  publicVideoUrl,
  submitProductVideoDelete,
  submitProductVideoReplace,
  submitProductVideoUpload,
  videoMimeFromName,
  type ProductVideoFile,
  type SellerProductVideo,
  type VideoFailure,
  type VideoIssue,
} from '../seller/video';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type VideoNotice = VideoIssue | VideoFailure | 'permission' | 'pickerFailed' | 'openFailed' | 'uploaded' | 'deleted';

const NOTICE_KEY: Record<VideoNotice, MessageKey> = {
  unsupported: 'seller.video.unsupported',
  tooLarge: 'seller.video.tooLarge',
  missingFile: 'seller.video.pickerFailed',
  maxReached: 'seller.video.maxReached',
  permission: 'seller.video.permission',
  pickerFailed: 'seller.video.pickerFailed',
  openFailed: 'seller.video.openFailed',
  uploaded: 'seller.video.uploaded',
  deleted: 'seller.video.deleted',
  validation: 'seller.video.uploadFailed',
  unauthorized: 'seller.video.unauthorized',
  forbidden: 'seller.video.forbidden',
  rateLimit: 'seller.video.uploadFailed',
  network: 'seller.video.network',
  generic: 'seller.video.uploadFailed',
  notFound: 'seller.video.notFound',
  conflict: 'seller.video.uploadFailed',
};

type SellerProductVideoProps = {
  productId: string | null;
  videos: SellerProductVideo[];
  onUpdated: (product: SellerProductDetail) => void;
};

export function SellerProductVideoSection({ productId, videos, onUpdated }: SellerProductVideoProps) {
  const { t } = useI18n();
  const { spacing } = useTheme();
  const { api } = useAuth();
  const gate = useRef<DraftGate>({ pending: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<VideoNotice | null>(null);
  const [noticeAction, setNoticeAction] = useState<'upload' | 'delete'>('upload');
  const current = videos[0] ?? null;

  const apply = (product: SellerProductDetail | undefined, next: VideoNotice | null) => {
    if (product) {
      onUpdated(product);
    }
    setNotice(next);
  };

  const pick = async (): Promise<ProductVideoFile | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNoticeAction('upload');
      setNotice('permission');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) {
      return null;
    }
    const asset = result.assets[0];
    const name = asset.fileName?.trim() || 'video.mp4';
    let mimeType = asset.mimeType ?? videoMimeFromName(name);
    if (!mimeType) {
      mimeType = (await readLocalVideoMime(asset.uri)) ?? 'application/octet-stream';
    }
    return { uri: asset.uri, name, mimeType, fileSize: asset.fileSize };
  };

  const add = async () => {
    if (!productId || busy) {
      return;
    }
    setNotice(null);
    const file = await pick();
    if (!file) {
      return;
    }
    setNoticeAction('upload');
    const result = await submitProductVideoUpload({
      productId,
      file,
      currentCount: videos.length,
      gate: gate.current,
      upload: (id, next) => uploadProductVideo(api, id, next),
      onPending: setBusy,
    });
    if (result.status === 'uploaded') {
      apply(result.product, 'uploaded');
      return;
    }
    if (result.status === 'invalid') {
      setNotice(result.issue);
      return;
    }
    if (result.status === 'failed') {
      setNotice(result.failure);
    }
  };

  const replace = async () => {
    if (!productId || !current || busy) {
      return;
    }
    setNotice(null);
    const file = await pick();
    if (!file) {
      return;
    }
    setNoticeAction('upload');
    const result = await submitProductVideoReplace({
      productId,
      file,
      existingVideoId: current.id,
      ask: () =>
        confirmChoice(
          t('seller.video.replaceTitle'),
          t('seller.video.replaceConfirm'),
          t('seller.video.cancel'),
          t('seller.video.replace'),
        ),
      gate: gate.current,
      remove: (id, videoId) => deleteProductVideo(api, id, videoId),
      upload: (id, next) => uploadProductVideo(api, id, next),
      onPending: setBusy,
    });
    if (result.status === 'replaced') {
      apply(result.product, 'uploaded');
      return;
    }
    if (result.status === 'invalid') {
      setNotice(result.issue);
      return;
    }
    if (result.status === 'failed') {
      apply(result.product, result.failure);
    }
  };

  const remove = async () => {
    if (!productId || !current || busy) {
      return;
    }
    setNotice(null);
    setNoticeAction('delete');
    const result = await submitProductVideoDelete({
      productId,
      videoId: current.id,
      ask: () =>
        confirmChoice(
          t('seller.video.deleteTitle'),
          t('seller.video.deleteConfirm'),
          t('seller.video.cancel'),
          t('seller.video.delete'),
        ),
      gate: gate.current,
      remove: (id, videoId) => deleteProductVideo(api, id, videoId),
      onPending: setBusy,
    });
    if (result.status === 'deleted') {
      apply(result.product, 'deleted');
      return;
    }
    if (result.status === 'failed') {
      setNotice(result.failure === 'generic' ? 'generic' : result.failure);
    }
  };

  const open = async () => {
    if (!current) {
      return;
    }
    const url = publicVideoUrl(current.url, apiBaseUrlFromEnv());
    if (!url) {
      setNotice('openFailed');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      setNotice('openFailed');
    }
  };

  const failureText =
    notice == null
      ? null
      : noticeAction === 'delete' && (notice === 'generic' || notice === 'validation' || notice === 'network')
        ? t('seller.video.deleteFailed')
        : t(NOTICE_KEY[notice]);

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong">{t('seller.video.title')}</AppText>
      <AppText tone="secondary">{t('seller.video.subtitle')}</AppText>
      {productId == null ? <AppText tone="secondary">{t('seller.video.saveFirst')}</AppText> : null}
      {productId != null && current == null ? <AppText tone="secondary">{t('seller.video.empty')}</AppText> : null}
      {current ? (
        <View style={{ gap: spacing.sm }}>
          <AppText>{current.fileName}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <AppButton label={t('seller.video.open')} variant="secondary" onPress={() => void open()} disabled={busy} />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <AppButton
                label={busy ? t('seller.video.uploading') : t('seller.video.replace')}
                variant="secondary"
                onPress={() => void replace()}
                loading={busy}
              />
            </View>
          </View>
          <AppButton
            label={t('seller.video.delete')}
            variant="ghost"
            onPress={() => void remove()}
            disabled={busy}
          />
        </View>
      ) : (
        <AppButton
          label={busy ? t('seller.video.uploading') : t('seller.video.add')}
          variant="secondary"
          onPress={() => void add()}
          loading={busy}
          disabled={productId == null}
        />
      )}
      {failureText && notice !== 'uploaded' && notice !== 'deleted' ? (
        <AppText tone="danger">{failureText}</AppText>
      ) : null}
      {notice === 'uploaded' || notice === 'deleted' ? <AppText tone="secondary">{failureText}</AppText> : null}
    </View>
  );
}

function confirmChoice(
  title: string,
  body: string,
  cancel: string,
  destructive: string,
): Promise<'cancel' | 'confirm'> {
  return new Promise((resolve) => {
    Alert.alert(title, body, [
      { text: cancel, style: 'cancel', onPress: () => resolve('cancel') },
      { text: destructive, style: 'destructive', onPress: () => resolve('confirm') },
    ]);
  });
}

async function readLocalVideoMime(uri: string): Promise<string | null | undefined> {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      return undefined;
    }
    return classifyVideoBytes(new Uint8Array(await response.arrayBuffer()).slice(0, 32));
  } catch {
    return undefined;
  }
}
