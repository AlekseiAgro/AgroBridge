import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';

import { apiBaseUrlFromEnv, joinApiUrl } from '../api/config';
import { useAuth } from '../auth/AuthProvider';
import type { MessageKey } from '../i18n/en';
import { useI18n } from '../i18n/I18nProvider';
import {
  canAddCertificate,
  CERTIFICATE_TYPES,
  certificateMimeFromName,
  classifyCertificateBytes,
  openCertificateDocument,
  submitCertificateDelete,
  submitCertificateUpload,
  type CertificateFailure,
  type CertificateFile,
  type CertificateIssue,
  type CertificateType,
  type SellerProductCertificate,
} from '../seller/certificates';
import { deleteProductCertificate, uploadProductCertificate } from '../seller/certificates-api';
import type { DraftGate } from '../seller/draft';
import type { SellerProductDetail } from '../seller/edit';
import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { Badge, type BadgeTone } from './Badge';
import { Chip } from './Chip';

type CertificateNotice =
  | CertificateIssue
  | CertificateFailure
  | 'pickerFailed'
  | 'openFailed'
  | 'uploaded'
  | 'deleted';

const NOTICE_KEY: Record<CertificateNotice, MessageKey> = {
  titleRequired: 'seller.certificates.titleRequired',
  unsupported: 'seller.certificates.unsupported',
  tooLarge: 'seller.certificates.tooLarge',
  missingFile: 'seller.certificates.fileRequired',
  maxReached: 'seller.certificates.maxReached',
  pickerFailed: 'seller.certificates.pickerFailed',
  openFailed: 'seller.certificates.openFailed',
  uploaded: 'seller.certificates.uploaded',
  deleted: 'seller.certificates.deleted',
  validation: 'seller.certificates.uploadFailed',
  unauthorized: 'seller.certificates.unauthorized',
  forbidden: 'seller.certificates.forbidden',
  rateLimit: 'seller.certificates.uploadFailed',
  network: 'seller.certificates.network',
  generic: 'seller.certificates.uploadFailed',
  notFound: 'seller.certificates.notFound',
  conflict: 'seller.certificates.uploadFailed',
};

const TYPE_KEY: Record<CertificateType, MessageKey> = {
  globalGap: 'seller.certificates.type.globalGap',
  organic: 'seller.certificates.type.organic',
  haccp: 'seller.certificates.type.haccp',
  iso: 'seller.certificates.type.iso',
  grasp: 'seller.certificates.type.grasp',
  other: 'seller.certificates.type.other',
};

const STATUS_KEY: Record<SellerProductCertificate['reviewStatus'], MessageKey> = {
  pending: 'seller.certificates.status.pending',
  approved: 'seller.certificates.status.approved',
  rejected: 'seller.certificates.status.rejected',
};

const CERTIFICATE_TONE: Record<SellerProductCertificate['reviewStatus'], BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

type SellerProductCertificatesProps = {
  productId: string | null;
  certificates: SellerProductCertificate[];
  onUpdated: (product: SellerProductDetail) => void;
};

export function SellerProductCertificates({ productId, certificates, onUpdated }: SellerProductCertificatesProps) {
  const { t } = useI18n();
  const { colors, spacing, radii, borders } = useTheme();
  const { api } = useAuth();
  const gate = useRef<DraftGate>({ pending: false });
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<CertificateType>('organic');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<CertificateFile | null>(null);
  const [notice, setNotice] = useState<CertificateNotice | null>(null);
  const [noticeAction, setNoticeAction] = useState<'upload' | 'delete' | 'open'>('upload');
  const canAdd = canAddCertificate(certificates.length);

  const upload = async () => {
    if (!productId || busy) {
      return;
    }
    setNoticeAction('upload');
    if (!file) {
      setNotice('missingFile');
      return;
    }
    const result = await submitCertificateUpload({
      productId,
      type,
      title,
      file,
      currentCount: certificates.length,
      gate: gate.current,
      upload: (id, nextType, nextTitle, nextFile) => uploadProductCertificate(api, id, nextType, nextTitle, nextFile),
      onPending: setBusy,
    });
    if (result.status === 'uploaded') {
      onUpdated(result.product);
      setTitle('');
      setFile(null);
      setNotice('uploaded');
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

  const pick = async () => {
    if (!productId || busy || !canAdd) {
      return;
    }
    setNotice(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }
      const asset = result.assets[0];
      let mimeType = asset.mimeType ?? certificateMimeFromName(asset.name);
      if (!mimeType) {
        mimeType = (await readLocalCertificateMime(asset.uri)) ?? 'application/octet-stream';
      }
      setFile({
        uri: asset.uri,
        name: asset.name,
        mimeType,
        fileSize: asset.size,
      });
    } catch {
      setNotice('pickerFailed');
    }
  };

  const remove = async (certificate: SellerProductCertificate) => {
    if (!productId || busy) {
      return;
    }
    setNotice(null);
    setNoticeAction('delete');
    const result = await submitCertificateDelete({
      productId,
      certificateId: certificate.id,
      ask: () =>
        confirmChoice(
          t('seller.certificates.deleteTitle'),
          t('seller.certificates.deleteConfirm', { name: certificate.title }),
          t('seller.certificates.cancel'),
          t('seller.certificates.delete'),
        ),
      gate: gate.current,
      remove: (id, certificateId) => deleteProductCertificate(api, id, certificateId),
      onPending: setBusy,
    });
    if (result.status === 'deleted') {
      onUpdated(result.product);
      setNotice('deleted');
      return;
    }
    if (result.status === 'failed') {
      setNotice(result.failure);
    }
  };

  const open = async (certificate: SellerProductCertificate) => {
    if (!productId || busy) {
      return;
    }
    setNoticeAction('open');
    setNotice(null);
    const result = await openCertificateDocument({
      productId,
      certificateId: certificate.id,
      fileName: certificate.fileName,
      download: async (path, fileName) => {
        const destination = new File(Paths.cache, fileName);
        const downloaded = await File.downloadFileAsync(joinApiUrl(apiBaseUrlFromEnv(), path), destination, {
          headers: await api.authHeaders(),
          idempotent: true,
        });
        return { uri: downloaded.uri };
      },
      canShare: () => Sharing.isAvailableAsync(),
      share: (uri) => Sharing.shareAsync(uri, { mimeType: certificate.mimeType || undefined }),
    });
    if (result !== 'opened') {
      setNotice('openFailed');
    }
  };

  const inputStyle = {
    minHeight: 48,
    borderWidth: borders.hairline,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.ink,
    backgroundColor: colors.surface,
  };

  const message =
    notice == null
      ? null
      : noticeAction === 'delete' && notice !== 'deleted' && notice !== 'uploaded'
        ? t(notice === 'notFound' || notice === 'unauthorized' || notice === 'forbidden' ? NOTICE_KEY[notice] : 'seller.certificates.deleteFailed')
        : t(NOTICE_KEY[notice]);

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label">{t('seller.certificates.title')}</AppText>
      <AppText tone="secondary">{t('seller.certificates.subtitle')}</AppText>
      {productId == null ? <AppText tone="secondary">{t('seller.certificates.saveFirst')}</AppText> : null}
      {productId != null && certificates.length === 0 ? (
        <AppText tone="secondary">{t('seller.certificates.empty')}</AppText>
      ) : null}
      {certificates.map((certificate) => (
        <View
          key={certificate.id}
          style={{
            gap: spacing.xs,
            paddingVertical: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <AppText variant="bodyStrong">{certificate.title}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
            <Badge label={t(TYPE_KEY[certificate.type])} />
            <Badge
              label={t(STATUS_KEY[certificate.reviewStatus])}
              tone={CERTIFICATE_TONE[certificate.reviewStatus]}
            />
          </View>
          <AppText variant="caption" tone="secondary">
            {certificate.fileName}
          </AppText>
          {certificate.reviewNote ? (
            <AppText tone="secondary">
              {t('seller.certificates.note')}: {certificate.reviewNote}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <AppButton
                label={t('seller.certificates.open')}
                variant="secondary"
                onPress={() => void open(certificate)}
                disabled={busy}
              />
            </View>
            <View style={{ flexGrow: 1, flexBasis: 140 }}>
              <AppButton
                label={t('seller.certificates.delete')}
                variant="ghost"
                onPress={() => void remove(certificate)}
                disabled={busy}
              />
            </View>
          </View>
        </View>
      ))}
      {productId != null && canAdd ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">{t('seller.certificates.type')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {CERTIFICATE_TYPES.map((value) => (
              <Chip
                key={value}
                label={t(TYPE_KEY[value])}
                selected={type === value}
                onPress={busy ? undefined : () => setType(value)}
              />
            ))}
          </View>
          <AppText variant="label">{t('seller.certificates.titleField')}</AppText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            editable={!busy}
            accessibilityLabel={t('seller.certificates.titleField')}
            placeholder={t('seller.certificates.titlePlaceholder')}
            placeholderTextColor={colors.muted}
            style={inputStyle}
          />
          <AppButton
            label={file ? file.name : t('seller.certificates.selectFile')}
            variant="secondary"
            onPress={() => void pick()}
            disabled={busy}
          />
          <AppButton
            label={busy ? t('seller.certificates.uploading') : t('seller.certificates.upload')}
            onPress={() => void upload()}
            loading={busy}
          />
        </View>
      ) : null}
      {productId != null && !canAdd ? <AppText tone="secondary">{t('seller.certificates.maxReached')}</AppText> : null}
      {message ? (
        <AppText tone={notice === 'uploaded' || notice === 'deleted' ? 'secondary' : 'danger'}>{message}</AppText>
      ) : null}
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

async function readLocalCertificateMime(uri: string): Promise<string | null | undefined> {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      return undefined;
    }
    return classifyCertificateBytes(new Uint8Array(await response.arrayBuffer()).slice(0, 32));
  } catch {
    return undefined;
  }
}
