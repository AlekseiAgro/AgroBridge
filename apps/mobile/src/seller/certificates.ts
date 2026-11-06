import { joinApiUrl } from '../api/config';
import { ApiError } from '../api/errors';
import { draftFailure, type DraftFailure, type DraftGate } from './draft';
import { classifyImageBytes, multipartFileValue, type ProductPhotoFile } from './photos';

/** Mirrors the API certificate contract. Title is required and has no maximum length. */
export const CERTIFICATE_MAX_COUNT = 10;
export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
export const CERTIFICATE_TYPES = ['globalGap', 'organic', 'haccp', 'iso', 'grasp', 'other'] as const;
export const CERTIFICATE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const CERTIFICATE_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type CertificateType = (typeof CERTIFICATE_TYPES)[number];
export type CertificateReviewStatus = (typeof CERTIFICATE_REVIEW_STATUSES)[number];
export type CertificateMimeType = (typeof CERTIFICATE_MIME_TYPES)[number];

export type SellerProductCertificate = {
  id: string;
  type: CertificateType;
  title: string;
  fileName: string;
  mimeType: string;
  reviewStatus: CertificateReviewStatus;
  reviewNote: string | null;
};

export type CertificateFile = ProductPhotoFile;

export type CertificateIssue = 'titleRequired' | 'unsupported' | 'tooLarge' | 'missingFile' | 'maxReached';

export type CertificateFailure = DraftFailure | 'notFound' | 'conflict';

export type CertificateChoice = 'cancel' | 'confirm';

export type CertificateSubmitResult<T> =
  | { status: 'ignored' }
  | { status: 'cancelled' }
  | { status: 'invalid'; issue: CertificateIssue }
  | { status: 'uploaded'; product: T }
  | { status: 'deleted'; product: T }
  | { status: 'failed'; failure: CertificateFailure };

export type CertificateOpenResult = 'opened' | 'unavailable' | 'failed';

const MIME_TYPES: readonly string[] = CERTIFICATE_MIME_TYPES;

const EXTENSION_MIME: Record<string, CertificateMimeType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function isCertificateType(value: string): value is CertificateType {
  return (CERTIFICATE_TYPES as readonly string[]).includes(value);
}

export function certificateUploadPath(productId: string): string {
  return `/products/${productId}/certificates`;
}

export function certificateDeletePath(productId: string, certificateId: string): string {
  return `/products/${productId}/certificates/${certificateId}`;
}

/** Private file route. Storage keys and public CDN URLs are never used. */
export function certificateFilePath(productId: string, certificateId: string): string {
  return `/products/${productId}/certificates/${certificateId}/file`;
}

export function certificateDownloadUrl(apiBaseUrl: string, productId: string, certificateId: string): string {
  return joinApiUrl(apiBaseUrl, certificateFilePath(productId, certificateId));
}

export function certificateSaveName(fileName: string, certificateId: string): string {
  const cleaned = fileName.trim().replace(/[\\/]/g, '_');
  const name = cleaned || `certificate-${certificateId}`;
  return name.slice(0, 120);
}

export function canAddCertificate(count: number): boolean {
  return count < CERTIFICATE_MAX_COUNT;
}

export function certificateTitleIssue(title: string): 'titleRequired' | null {
  return title.trim() ? null : 'titleRequired';
}

export function normalizeCertificateMime(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }
  const mime = mimeType.trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') {
    return null;
  }
  if (mime === 'image/jpg' || mime === 'image/pjpeg') {
    return 'image/jpeg';
  }
  return mime;
}

export function certificateMimeFromName(name: string): CertificateMimeType | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!match?.[1]) {
    return null;
  }
  return EXTENSION_MIME[match[1].toLowerCase()] ?? null;
}

export function classifyCertificateBytes(bytes: Uint8Array): CertificateMimeType | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  const image = classifyImageBytes(bytes);
  if (image === 'image/jpeg' || image === 'image/png' || image === 'image/webp') {
    return image;
  }
  return null;
}

export function certificateFileIssue(file: CertificateFile, currentCount: number): CertificateIssue | null {
  if (!canAddCertificate(currentCount)) {
    return 'maxReached';
  }
  if (!file.uri.trim()) {
    return 'missingFile';
  }
  const declared = normalizeCertificateMime(file.mimeType);
  if (declared && !MIME_TYPES.includes(declared)) {
    return 'unsupported';
  }
  const resolved =
    (declared && MIME_TYPES.includes(declared) ? declared : null) ?? certificateMimeFromName(file.name);
  if (!resolved || !MIME_TYPES.includes(resolved)) {
    return 'unsupported';
  }
  const size = knownFileSize(file.fileSize);
  if (size != null && size > CERTIFICATE_MAX_BYTES) {
    return 'tooLarge';
  }
  return null;
}

export function parseProductCertificates(value: unknown): SellerProductCertificate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const certificates: SellerProductCertificate[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const type = typeof row.type === 'string' ? row.type : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const fileName = typeof row.fileName === 'string' ? row.fileName.trim() : '';
    const reviewStatus = typeof row.reviewStatus === 'string' ? row.reviewStatus : '';
    if (!id || !title || !fileName || !isCertificateType(type) || !isReviewStatus(reviewStatus)) {
      continue;
    }
    const note = row.reviewNote;
    certificates.push({
      id,
      type,
      title,
      fileName,
      mimeType: typeof row.mimeType === 'string' ? row.mimeType : '',
      reviewStatus,
      reviewNote: typeof note === 'string' && note.trim() ? note.trim() : null,
    });
  }
  return certificates;
}

export function fillCertificateForm(
  form: FormData,
  input: { type: CertificateType; title: string; file: CertificateFile },
  native = isReactNative(),
): void {
  form.append('type', input.type);
  form.append('title', input.title.trim());
  form.append('file', multipartFileValue(input.file, native) as Blob);
}

export function certificateFailure(error: unknown): CertificateFailure {
  if (error instanceof ApiError && error.status === 404) {
    return 'notFound';
  }
  if (error instanceof ApiError && error.status === 409) {
    return 'conflict';
  }
  return draftFailure(error);
}

export async function submitCertificateUpload<T>(options: {
  productId: string;
  type: CertificateType;
  title: string;
  file: CertificateFile;
  currentCount: number;
  gate: DraftGate;
  upload: (productId: string, type: CertificateType, title: string, file: CertificateFile) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<CertificateSubmitResult<T>> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  const titleIssue = certificateTitleIssue(options.title);
  if (titleIssue) {
    return { status: 'invalid', issue: titleIssue };
  }
  const issue = certificateFileIssue(options.file, options.currentCount);
  if (issue) {
    return { status: 'invalid', issue };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.upload(options.productId, options.type, options.title.trim(), options.file);
    return { status: 'uploaded', product };
  } catch (error) {
    return { status: 'failed', failure: certificateFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export async function submitCertificateDelete<T>(options: {
  productId: string;
  certificateId: string;
  ask: () => Promise<CertificateChoice>;
  gate: DraftGate;
  remove: (productId: string, certificateId: string) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<CertificateSubmitResult<T>> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  options.gate.pending = true;
  try {
    const choice = await options.ask();
    if (choice !== 'confirm') {
      return { status: 'cancelled' };
    }
    options.onPending(true);
    const product = await options.remove(options.productId, options.certificateId);
    return { status: 'deleted', product };
  } catch (error) {
    return { status: 'failed', failure: certificateFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

/** Downloads the authorized private file and hands it to the platform share sheet. */
export async function openCertificateDocument(options: {
  productId: string;
  certificateId: string;
  fileName: string;
  download: (path: string, fileName: string) => Promise<{ uri: string }>;
  canShare: () => Promise<boolean>;
  share: (uri: string) => Promise<void>;
}): Promise<CertificateOpenResult> {
  try {
    const available = await options.canShare();
    if (!available) {
      return 'unavailable';
    }
    const file = await options.download(
      certificateFilePath(options.productId, options.certificateId),
      certificateSaveName(options.fileName, options.certificateId),
    );
    await options.share(file.uri);
    return 'opened';
  } catch {
    return 'failed';
  }
}

function isReviewStatus(value: string): value is CertificateReviewStatus {
  return (CERTIFICATE_REVIEW_STATUSES as readonly string[]).includes(value);
}

function knownFileSize(fileSize: number | null | undefined): number | null {
  if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || fileSize < 0) {
    return null;
  }
  return fileSize;
}

function isReactNative(): boolean {
  return typeof navigator !== 'undefined' && (navigator as { product?: string }).product === 'ReactNative';
}
