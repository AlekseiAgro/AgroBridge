import { joinApiUrl } from '../api/config';
import { ApiError } from '../api/errors';
import { isGeorgiaRegion } from '../catalog/categories';
import { certificateMimeFromName, normalizeCertificateMime } from './certificates';
import { draftFailure, type DraftFailure, type DraftGate } from './draft';
import { classifyImageBytes, multipartFileValue, normalizePhotoMime, type ProductPhotoFile } from './photos';

/** Farm photos are a separate limit from product photos. */
export const FARM_PHOTO_MAX_COUNT = 3;
export const FARM_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const FARM_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const FARM_DOCUMENT_MAX_COUNT = 10;
export const FARM_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const FARM_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const FARM_DOCUMENT_KINDS = ['idCard', 'businessRegistration', 'other'] as const;
export const FARM_VERIFICATION_STATUSES = ['unverified', 'pending', 'approved', 'rejected'] as const;
export const FARM_PRODUCER_TYPES = ['individual', 'family', 'cooperative', 'company', 'other'] as const;
export const FARM_SELLER_TYPES = ['privateFarmer', 'company'] as const;
export const FARM_REASON_CODES = [
  'documentRejected',
  'registryNotConfirmed',
  'contactConfirmationRequired',
  'moderatorRejected',
] as const;
export const DOCUMENT_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

export const FARM_NAME_MIN = 2;
export const FARM_NAME_MAX = 120;
export const FARM_REGION_MAX = 120;
export const FARM_DESCRIPTION_MAX = 2000;
export const FARM_HISTORY_MAX = 4000;
export const FARM_MARKET_MAX = 120;
export const FARM_MARKETS_MAX = 50;
export const FARM_YEAR_MIN = 1800;
export const FARM_YEAR_MAX = 2200;

export type FarmProducerType = (typeof FARM_PRODUCER_TYPES)[number];
export type FarmDocumentKind = (typeof FARM_DOCUMENT_KINDS)[number];
export type FarmVerificationStatus = (typeof FARM_VERIFICATION_STATUSES)[number];
export type FarmSellerType = (typeof FARM_SELLER_TYPES)[number];
export type FarmReasonCode = (typeof FARM_REASON_CODES)[number];
export type FarmDocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];
export type FarmPhotoMime = (typeof FARM_PHOTO_MIME_TYPES)[number];
export type FarmDocumentMime = (typeof FARM_DOCUMENT_MIME_TYPES)[number];

export type FarmPhoto = {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type FarmDocument = {
  id: string;
  title: string;
  fileName: string;
  kind: FarmDocumentKind;
  reviewStatus: FarmDocumentReviewStatus;
  reviewNote: string | null;
};

export type FarmProfile = {
  id: string;
  name: string;
  region: string | null;
  description: string | null;
  foundedYear: number | null;
  farmSizeHectares: number | null;
  producerType: FarmProducerType | null;
  ownershipType: string | null;
  exportMarkets: string[];
  history: string | null;
  verificationStatus: FarmVerificationStatus;
  photos: FarmPhoto[];
  documents: FarmDocument[];
};

export type FarmFormValues = {
  name: string;
  region: string;
  description: string;
  foundedYear: string;
  farmSizeHectares: string;
  producerType: FarmProducerType | '';
  exportMarkets: string;
  history: string;
};

export type FarmFieldIssue =
  | 'nameRequired'
  | 'nameTooLong'
  | 'descriptionTooLong'
  | 'historyTooLong'
  | 'yearInvalid'
  | 'sizeInvalid'
  | 'marketTooLong'
  | 'tooManyMarkets';

export type FarmWriteBody = {
  name: string;
  region: string;
  description: string;
  foundedYear?: number;
  farmSizeHectares?: number;
  producerType: FarmProducerType | null;
  exportMarkets: string[];
  history: string;
};

export type FarmVerification = {
  verified: boolean;
  farmVerificationStatus: FarmVerificationStatus;
  verificationReasonCode: FarmReasonCode | null;
  moderatorComment: string | null;
  sellerType: FarmSellerType | null;
  phone: string | null;
  phoneVerified: boolean;
  companyRegistrationNumber: string | null;
  companyRegistryName: string | null;
  companyRegistryValid: boolean | null;
  sellerTypeLocked: boolean;
  path: 'company' | 'privateFarmer' | 'unknown';
};

export type FarmMediaIssue =
  | 'unsupported'
  | 'tooLarge'
  | 'maxReached'
  | 'missingFile'
  | 'titleRequired'
  | 'deleteBlocked';

export type FarmFailure = DraftFailure | 'notFound' | 'conflict';

export type FarmChoice = 'cancel' | 'confirm';

export type FarmSaveResult =
  | { status: 'ignored' }
  | { status: 'invalid'; issue: FarmFieldIssue }
  | { status: 'saved'; farm: FarmProfile }
  | { status: 'failed'; failure: FarmFailure };

export type FarmMediaResult<T> =
  | { status: 'ignored' }
  | { status: 'cancelled' }
  | { status: 'invalid'; issue: FarmMediaIssue }
  | { status: 'saved'; value: T }
  | { status: 'failed'; failure: FarmFailure };

const PHOTO_MIMES: readonly string[] = FARM_PHOTO_MIME_TYPES;
const DOCUMENT_MIMES: readonly string[] = FARM_DOCUMENT_MIME_TYPES;

export function farmMinePath(): string {
  return '/farms/me';
}

export function farmCreatePath(): string {
  return '/farms';
}

export function farmPhotoUploadPath(): string {
  return '/farms/me/photos';
}

export function farmPhotoDeletePath(photoId: string): string {
  return `/farms/me/photos/${photoId}`;
}

export function farmPhotoPrimaryPath(photoId: string): string {
  return `/farms/me/photos/${photoId}/primary`;
}

export function farmDocumentsPath(): string {
  return '/farms/me/documents';
}

export function farmDocumentDeletePath(documentId: string): string {
  return `/farms/me/documents/${documentId}`;
}

/** Authenticated private download. Never a storage key or public CDN URL. */
export function farmDocumentFilePath(documentId: string): string {
  return `/farms/documents/${documentId}/file`;
}

export function farmDocumentDownloadUrl(apiBaseUrl: string, documentId: string): string {
  return joinApiUrl(apiBaseUrl, farmDocumentFilePath(documentId));
}

export function verificationStatusPath(): string {
  return '/verification/me';
}

export function sellerTypePath(): string {
  return '/verification/seller-type';
}

export function companyRegistryPath(): string {
  return '/verification/company/registry';
}

export function phoneSendPath(): string {
  return '/verification/phone/send-code';
}

export function phoneConfirmPath(): string {
  return '/verification/phone/confirm';
}

export function isFarmProducerType(value: string): value is FarmProducerType {
  return (FARM_PRODUCER_TYPES as readonly string[]).includes(value);
}

export function isFarmDocumentKind(value: string): value is FarmDocumentKind {
  return (FARM_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isPrimaryVerificationKind(kind: string): boolean {
  return kind === 'idCard' || kind === 'businessRegistration';
}

/** Identity upload is the submission. There is no separate seller submit action. */
export function identityUploadSubmitsReview(kind: string): boolean {
  return isPrimaryVerificationKind(kind);
}

export function verificationSectionState(input: {
  hasFarm: boolean;
  verification: FarmVerification | null;
  failed: boolean;
}): 'hidden' | 'ready' | 'unavailable' {
  if (!input.hasFarm) return 'hidden';
  if (input.verification) return 'ready';
  return input.failed ? 'unavailable' : 'hidden';
}

export function primaryKindForSeller(sellerType: FarmSellerType | null): FarmDocumentKind | null {
  if (sellerType === 'privateFarmer') return 'idCard';
  if (sellerType === 'company') return 'businessRegistration';
  return null;
}

export function emptyFarmForm(): FarmFormValues {
  return {
    name: '',
    region: '',
    description: '',
    foundedYear: '',
    farmSizeHectares: '',
    producerType: '',
    exportMarkets: '',
    history: '',
  };
}

export function farmFormFromProfile(farm: FarmProfile): FarmFormValues {
  return {
    name: farm.name,
    region: farm.region ?? '',
    description: farm.description ?? '',
    foundedYear: farm.foundedYear == null ? '' : String(farm.foundedYear),
    farmSizeHectares: farm.farmSizeHectares == null ? '' : String(farm.farmSizeHectares),
    producerType: farm.producerType ?? '',
    exportMarkets: farm.exportMarkets.join(', '),
    history: farm.history ?? '',
  };
}

export function parseExportMarkets(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

export function farmFieldIssue(values: FarmFormValues): FarmFieldIssue | null {
  const name = values.name.trim();
  if (name.length < FARM_NAME_MIN) return 'nameRequired';
  if (name.length > FARM_NAME_MAX) return 'nameTooLong';
  if (values.description.trim().length > FARM_DESCRIPTION_MAX) return 'descriptionTooLong';
  if (values.history.trim().length > FARM_HISTORY_MAX) return 'historyTooLong';
  const year = values.foundedYear.trim();
  if (year) {
    if (!/^\d{4}$/.test(year)) return 'yearInvalid';
    const parsed = Number(year);
    if (parsed < FARM_YEAR_MIN || parsed > FARM_YEAR_MAX) return 'yearInvalid';
  }
  const size = values.farmSizeHectares.trim().replace(',', '.');
  if (size) {
    if (!/^\d+(\.\d{1,2})?$/.test(size) || Number(size) < 0) return 'sizeInvalid';
  }
  const markets = parseExportMarkets(values.exportMarkets);
  if (markets.length > FARM_MARKETS_MAX) return 'tooManyMarkets';
  if (markets.some((market) => market.length > FARM_MARKET_MAX)) return 'marketTooLong';
  return null;
}

export function farmWriteBody(values: FarmFormValues): FarmWriteBody {
  const year = values.foundedYear.trim();
  const size = values.farmSizeHectares.trim().replace(',', '.');
  return {
    name: values.name.trim(),
    region: values.region.trim(),
    description: values.description.trim(),
    ...(year ? { foundedYear: Number(year) } : {}),
    ...(size ? { farmSizeHectares: Number(size) } : {}),
    producerType: values.producerType || null,
    exportMarkets: parseExportMarkets(values.exportMarkets),
    history: values.history.trim(),
  };
}

/** Profile save never includes photos, documents, or product ids. */
export function farmSaveTouchesMedia(body: FarmWriteBody): boolean {
  return 'photos' in body || 'documents' in body || 'productIds' in body;
}

export function regionChoices(current: string): string[] {
  const regions: string[] = [...(isGeorgiaRegion(current) || !current ? [] : [current])];
  return [...regions, ...['tbilisi', 'adjara', 'guria', 'imereti', 'kakheti', 'kvemoKartli', 'mtskhetaMtianeti', 'rachaLechkhumiKvemoSvaneti', 'samegreloZemoSvaneti', 'samtskheJavakheti', 'shidaKartli']];
}

export function farmFailure(error: unknown): FarmFailure {
  if (error instanceof ApiError && error.status === 404) return 'notFound';
  if (error instanceof ApiError && error.status === 409) return 'conflict';
  return draftFailure(error);
}

export function farmPhotoIssue(file: ProductPhotoFile, currentCount: number): FarmMediaIssue | null {
  if (currentCount >= FARM_PHOTO_MAX_COUNT) return 'maxReached';
  if (!file.uri.trim()) return 'missingFile';
  if (file.fileSize != null && file.fileSize > FARM_PHOTO_MAX_BYTES) return 'tooLarge';
  if (!resolveFarmPhotoMime(file)) return 'unsupported';
  return null;
}

/** Photo types come from the picker or file bytes, never from the file name. */
export function resolveFarmPhotoMime(file: Pick<ProductPhotoFile, 'mimeType'>): FarmPhotoMime | null {
  const mime = normalizePhotoMime(file.mimeType);
  return mime && PHOTO_MIMES.includes(mime) ? (mime as FarmPhotoMime) : null;
}

export function farmPhotoMimeFromBytes(bytes: Uint8Array): FarmPhotoMime | null {
  const mime = classifyImageBytes(bytes);
  return mime && PHOTO_MIMES.includes(mime) ? (mime as FarmPhotoMime) : null;
}

export function fillFarmPhotoForm(
  form: { append(name: string, value: unknown): void },
  file: ProductPhotoFile,
  native = isReactNative(),
): void {
  form.append('file', multipartFileValue({ ...file, mimeType: resolveFarmPhotoMime(file) }, native, PHOTO_MIMES));
}

export function farmDocumentIssue(
  file: ProductPhotoFile,
  title: string,
  currentCount: number,
): FarmMediaIssue | null {
  if (currentCount >= FARM_DOCUMENT_MAX_COUNT) return 'maxReached';
  if (!title.trim()) return 'titleRequired';
  if (!file.uri.trim()) return 'missingFile';
  if (file.fileSize != null && file.fileSize > FARM_DOCUMENT_MAX_BYTES) return 'tooLarge';
  if (!resolveFarmDocumentMime(file)) return 'unsupported';
  return null;
}

/**
 * The declared type wins when it is usable. A missing or generic type falls back to the file name.
 * A declared type the API does not accept is not overridden by the name.
 */
export function resolveFarmDocumentMime(
  file: Pick<ProductPhotoFile, 'name' | 'mimeType'>,
): FarmDocumentMime | null {
  const declared = normalizeCertificateMime(file.mimeType);
  const mime = declared ?? certificateMimeFromName(file.name);
  return mime && DOCUMENT_MIMES.includes(mime) ? (mime as FarmDocumentMime) : null;
}

export function fillFarmDocumentForm(
  form: { append(name: string, value: unknown): void },
  input: { title: string; kind: FarmDocumentKind; file: ProductPhotoFile },
  native = isReactNative(),
): void {
  form.append('title', input.title.trim());
  form.append('kind', input.kind);
  form.append(
    'file',
    multipartFileValue({ ...input.file, mimeType: resolveFarmDocumentMime(input.file) }, native, DOCUMENT_MIMES),
  );
}

function isReactNative(): boolean {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

export function approvedPrimaryDocumentLocked(
  farmStatus: FarmVerificationStatus,
  document: Pick<FarmDocument, 'kind' | 'reviewStatus'>,
): boolean {
  return (
    farmStatus === 'approved' &&
    document.reviewStatus === 'approved' &&
    isPrimaryVerificationKind(document.kind)
  );
}

export function parseFarmProfile(value: unknown): FarmProfile | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  const status = typeof record.verificationStatus === 'string' ? record.verificationStatus : 'unverified';
  return {
    id: record.id,
    name: record.name,
    region: typeof record.region === 'string' ? record.region : null,
    description: typeof record.description === 'string' ? record.description : null,
    foundedYear: typeof record.foundedYear === 'number' ? record.foundedYear : null,
    farmSizeHectares: typeof record.farmSizeHectares === 'number' ? record.farmSizeHectares : null,
    producerType:
      typeof record.producerType === 'string' && isFarmProducerType(record.producerType)
        ? record.producerType
        : null,
    ownershipType: typeof record.ownershipType === 'string' ? record.ownershipType : null,
    exportMarkets: Array.isArray(record.exportMarkets)
      ? record.exportMarkets.filter((item): item is string => typeof item === 'string')
      : [],
    history: typeof record.history === 'string' ? record.history : null,
    verificationStatus: (FARM_VERIFICATION_STATUSES as readonly string[]).includes(status)
      ? (status as FarmVerificationStatus)
      : 'unverified',
    photos: parsePhotos(record.photos),
    documents: parseDocuments(record.documents),
  };
}

export function parseFarmVerification(value: unknown): FarmVerification | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const status = typeof record.farmVerificationStatus === 'string' ? record.farmVerificationStatus : '';
  if (!(FARM_VERIFICATION_STATUSES as readonly string[]).includes(status)) return null;
  const sellerType =
    typeof record.sellerType === 'string' &&
    (FARM_SELLER_TYPES as readonly string[]).includes(record.sellerType)
      ? (record.sellerType as FarmSellerType)
      : null;
  const reason =
    typeof record.verificationReasonCode === 'string' &&
    (FARM_REASON_CODES as readonly string[]).includes(record.verificationReasonCode)
      ? (record.verificationReasonCode as FarmReasonCode)
      : null;
  const path = record.path === 'company' || record.path === 'privateFarmer' ? record.path : 'unknown';
  return {
    verified: record.verified === true,
    farmVerificationStatus: status as FarmVerificationStatus,
    verificationReasonCode: reason,
    moderatorComment: typeof record.moderatorComment === 'string' ? record.moderatorComment : null,
    sellerType,
    phone: typeof record.phone === 'string' ? record.phone : null,
    phoneVerified: record.phoneVerified === true,
    companyRegistrationNumber:
      typeof record.companyRegistrationNumber === 'string' ? record.companyRegistrationNumber : null,
    companyRegistryName: typeof record.companyRegistryName === 'string' ? record.companyRegistryName : null,
    companyRegistryValid:
      typeof record.companyRegistryValid === 'boolean' ? record.companyRegistryValid : null,
    sellerTypeLocked: record.sellerTypeLocked === true,
    path,
  };
}

function parsePhotos(value: unknown): FarmPhoto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const photo = item as Record<string, unknown>;
    if (typeof photo.id !== 'string' || typeof photo.url !== 'string') return [];
    return [
      {
        id: photo.id,
        url: photo.url,
        sortOrder: typeof photo.sortOrder === 'number' ? photo.sortOrder : 0,
        isPrimary: photo.isPrimary === true,
      },
    ];
  });
}

function parseDocuments(value: unknown): FarmDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const doc = item as Record<string, unknown>;
    if (typeof doc.id !== 'string' || typeof doc.title !== 'string') return [];
    const kind = typeof doc.kind === 'string' && isFarmDocumentKind(doc.kind) ? doc.kind : 'other';
    const review =
      typeof doc.reviewStatus === 'string' &&
      (DOCUMENT_REVIEW_STATUSES as readonly string[]).includes(doc.reviewStatus)
        ? (doc.reviewStatus as FarmDocumentReviewStatus)
        : 'pending';
    return [
      {
        id: doc.id,
        title: doc.title,
        fileName: typeof doc.fileName === 'string' ? doc.fileName : '',
        kind,
        reviewStatus: review,
        reviewNote: typeof doc.reviewNote === 'string' ? doc.reviewNote : null,
      },
    ];
  });
}

export async function submitFarmSave(input: {
  mode: 'create' | 'edit';
  values: FarmFormValues;
  gate: DraftGate;
  save: (body: FarmWriteBody) => Promise<unknown>;
  onPending: (pending: boolean) => void;
}): Promise<FarmSaveResult> {
  if (input.gate.pending) return { status: 'ignored' };
  const issue = farmFieldIssue(input.values);
  if (issue) return { status: 'invalid', issue };
  const body = farmWriteBody(input.values);
  input.gate.pending = true;
  input.onPending(true);
  try {
    const farm = parseFarmProfile(await input.save(body));
    if (!farm) return { status: 'failed', failure: 'generic' };
    return { status: 'saved', farm };
  } catch (error) {
    return { status: 'failed', failure: farmFailure(error) };
  } finally {
    input.gate.pending = false;
    input.onPending(false);
  }
}

export async function submitFarmPhotoUpload(input: {
  file: ProductPhotoFile;
  currentCount: number;
  gate: DraftGate;
  upload: (file: ProductPhotoFile) => Promise<unknown>;
  onPending: (pending: boolean) => void;
}): Promise<FarmMediaResult<FarmProfile>> {
  if (input.gate.pending) return { status: 'ignored' };
  const issue = farmPhotoIssue(input.file, input.currentCount);
  if (issue) return { status: 'invalid', issue };
  input.gate.pending = true;
  input.onPending(true);
  try {
    const farm = parseFarmProfile(await input.upload(input.file));
    if (!farm) return { status: 'failed', failure: 'generic' };
    return { status: 'saved', value: farm };
  } catch (error) {
    return { status: 'failed', failure: farmFailure(error) };
  } finally {
    input.gate.pending = false;
    input.onPending(false);
  }
}

export async function submitFarmPhotoDelete(input: {
  gate: DraftGate;
  ask: () => Promise<FarmChoice>;
  remove: () => Promise<unknown>;
  onPending: (pending: boolean) => void;
}): Promise<FarmMediaResult<FarmProfile>> {
  if (input.gate.pending) return { status: 'ignored' };
  input.gate.pending = true;
  try {
    if ((await input.ask()) !== 'confirm') return { status: 'cancelled' };
    input.onPending(true);
    const farm = parseFarmProfile(await input.remove());
    if (!farm) return { status: 'failed', failure: 'generic' };
    return { status: 'saved', value: farm };
  } catch (error) {
    return { status: 'failed', failure: farmFailure(error) };
  } finally {
    input.gate.pending = false;
    input.onPending(false);
  }
}

export async function submitFarmPhotoPrimary(input: {
  gate: DraftGate;
  setPrimary: () => Promise<unknown>;
  onPending: (pending: boolean) => void;
}): Promise<FarmMediaResult<FarmProfile>> {
  if (input.gate.pending) return { status: 'ignored' };
  input.gate.pending = true;
  input.onPending(true);
  try {
    const farm = parseFarmProfile(await input.setPrimary());
    if (!farm) return { status: 'failed', failure: 'generic' };
    return { status: 'saved', value: farm };
  } catch (error) {
    return { status: 'failed', failure: farmFailure(error) };
  } finally {
    input.gate.pending = false;
    input.onPending(false);
  }
}

export async function submitFarmDocumentUpload(input: {
  file: ProductPhotoFile;
  title: string;
  kind: FarmDocumentKind;
  currentCount: number;
  gate: DraftGate;
  upload: () => Promise<unknown>;
  onPending: (pending: boolean) => void;
}): Promise<FarmMediaResult<{ submitsReview: boolean }>> {
  if (input.gate.pending) return { status: 'ignored' };
  const issue = farmDocumentIssue(input.file, input.title, input.currentCount);
  if (issue) return { status: 'invalid', issue };
  input.gate.pending = true;
  input.onPending(true);
  try {
    await input.upload();
    return { status: 'saved', value: { submitsReview: identityUploadSubmitsReview(input.kind) } };
  } catch (error) {
    return { status: 'failed', failure: farmFailure(error) };
  } finally {
    input.gate.pending = false;
    input.onPending(false);
  }
}

export async function submitFarmDocumentDelete(input: {
  locked: boolean;
  gate: DraftGate;
  ask: () => Promise<FarmChoice>;
  remove: () => Promise<unknown>;
  onPending: (pending: boolean) => void;
}): Promise<FarmMediaResult<null>> {
  if (input.locked) return { status: 'invalid', issue: 'deleteBlocked' };
  if (input.gate.pending) return { status: 'ignored' };
  input.gate.pending = true;
  try {
    if ((await input.ask()) !== 'confirm') return { status: 'cancelled' };
    input.onPending(true);
    await input.remove();
    return { status: 'saved', value: null };
  } catch (error) {
    return { status: 'failed', failure: farmFailure(error) };
  } finally {
    input.gate.pending = false;
    input.onPending(false);
  }
}
