import { draftFailure, type DraftFailure, type DraftGate } from './draft';

/** Mirrors the API product-image limits. */
export const PRODUCT_IMAGE_MAX_COUNT = 5;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PRODUCT_IMAGE_FIELD = 'file';
export const PRODUCT_IMAGE_KIND = 'overview';

export type SellerProductImage = {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type ProductPhotoFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type ProductImagePart = {
  uri: string;
  name: string;
  type?: string;
};

export type PhotoIssue = 'unsupported' | 'tooLarge' | 'maxReached' | 'missingFile';

export type PhotoSubmitResult<T> =
  | { status: 'ignored' }
  | { status: 'invalid'; issue: PhotoIssue }
  | { status: 'blocked'; issue: 'lastPublished' }
  | { status: 'uploaded'; product: T }
  | { status: 'deleted'; product: T }
  | { status: 'primary'; product: T }
  | { status: 'failed'; failure: DraftFailure };

const MIME_TYPES: readonly string[] = PRODUCT_IMAGE_MIME_TYPES;

export function productImageUploadPath(productId: string): string {
  return `/products/${productId}/images`;
}

export function productImageDeletePath(productId: string, imageId: string): string {
  return `/products/${productId}/images/${imageId}`;
}

export function productImagePrimaryPath(productId: string, imageId: string): string {
  return `/products/${productId}/images/${imageId}/primary`;
}

export function remainingPhotoSlots(count: number): number {
  return Math.max(0, PRODUCT_IMAGE_MAX_COUNT - count);
}

/** Keeps only as many files as the API still accepts. */
export function photoSelection(currentCount: number, selectedCount: number): { take: number; overflow: boolean } {
  const remaining = remainingPhotoSlots(currentCount);
  const take = Math.max(0, Math.min(selectedCount, remaining));
  return { take, overflow: selectedCount > remaining };
}

/** Identifies JPEG, PNG, or WebP from file bytes. Other content is unsupported. */
export function classifyImageBytes(bytes: Uint8Array): string | null {
  if (isJpeg(bytes)) {
    return 'image/jpeg';
  }
  if (isPng(bytes)) {
    return 'image/png';
  }
  if (isWebp(bytes)) {
    return 'image/webp';
  }
  return null;
}

/**
 * Reads a local picker file. A thrown or failed read means the type is unknown.
 * A successful read of a non-image returns null so the upload is rejected locally.
 */
export async function readLocalPhotoMime(
  uri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null | undefined> {
  try {
    const response = await fetchImpl(uri);
    if (!response.ok) {
      return undefined;
    }
    return classifyImageBytes(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return undefined;
  }
}

export function normalizePhotoMime(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }
  const mime = mimeType.trim().toLowerCase();
  if (!mime) {
    return null;
  }
  if (mime === 'image/jpg' || mime === 'image/pjpeg') {
    return 'image/jpeg';
  }
  return mime;
}

export function photoFileIssue(file: ProductPhotoFile, currentCount: number): PhotoIssue | null {
  if (currentCount >= PRODUCT_IMAGE_MAX_COUNT) {
    return 'maxReached';
  }
  if (!file.uri.trim()) {
    return 'missingFile';
  }
  const mime = normalizePhotoMime(file.mimeType);
  if (mime && !MIME_TYPES.includes(mime)) {
    return 'unsupported';
  }
  const size = knownFileSize(file.fileSize);
  if (size != null && size > PRODUCT_IMAGE_MAX_BYTES) {
    return 'tooLarge';
  }
  return null;
}

/** Published listings cannot drop to zero photos. Drafts can. */
export function lastPublishedPhotoBlocked(isPublished: boolean, count: number): boolean {
  return isPublished && count <= 1;
}

export function parseProductImages(value: unknown): SellerProductImage[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const images: SellerProductImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!id || !url) {
      continue;
    }
    const sortOrder =
      typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? row.sortOrder : images.length;
    images.push({
      id,
      url,
      sortOrder,
      isPrimary: row.isPrimary === true,
    });
  }
  return images;
}

export function productImagePart(file: ProductPhotoFile): ProductImagePart {
  const mime = normalizePhotoMime(file.mimeType);
  const part: ProductImagePart = {
    uri: file.uri,
    name: file.name.trim() || 'photo',
  };
  if (mime && MIME_TYPES.includes(mime)) {
    part.type = mime;
  }
  return part;
}

/** React Native sends a uri part. Tests and other hosts send a named file blob. */
export function multipartFileValue(file: ProductPhotoFile, native: boolean): Blob | ProductImagePart {
  const part = productImagePart(file);
  if (native) {
    return part;
  }
  return new File([], part.name, { type: part.type ?? 'application/octet-stream' });
}

export function fillProductImageForm(form: FormData, file: ProductPhotoFile, native = isReactNative()): void {
  form.append(PRODUCT_IMAGE_FIELD, multipartFileValue(file, native) as Blob);
  form.append('kind', PRODUCT_IMAGE_KIND);
}

export function productAfterMediaChange<T extends ProductMediaSnapshot>(current: T, next: ProductMediaSnapshot): T {
  return {
    ...current,
    images: next.images,
    isPublished: next.isPublished,
    moderationStatus: next.moderationStatus,
    moderationNote: next.moderationNote,
    ...(next.videos !== undefined ? { videos: next.videos } : {}),
    ...(next.certificates !== undefined ? { certificates: next.certificates } : {}),
  };
}

export async function submitProductPhotoUpload<T>(options: {
  productId: string;
  file: ProductPhotoFile;
  currentCount: number;
  gate: DraftGate;
  upload: (productId: string, file: ProductPhotoFile) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<PhotoSubmitResult<T>> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  const issue = photoFileIssue(options.file, options.currentCount);
  if (issue) {
    return { status: 'invalid', issue };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.upload(options.productId, options.file);
    return { status: 'uploaded', product };
  } catch (error) {
    return { status: 'failed', failure: draftFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export async function submitProductPhotoDelete<T>(options: {
  productId: string;
  imageId: string;
  isPublished: boolean;
  currentCount: number;
  gate: DraftGate;
  remove: (productId: string, imageId: string) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<PhotoSubmitResult<T>> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  if (lastPublishedPhotoBlocked(options.isPublished, options.currentCount)) {
    return { status: 'blocked', issue: 'lastPublished' };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.remove(options.productId, options.imageId);
    return { status: 'deleted', product };
  } catch (error) {
    return { status: 'failed', failure: draftFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export async function submitProductPhotoPrimary<T>(options: {
  productId: string;
  imageId: string;
  gate: DraftGate;
  setPrimary: (productId: string, imageId: string) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<PhotoSubmitResult<T>> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.setPrimary(options.productId, options.imageId);
    return { status: 'primary', product };
  } catch (error) {
    return { status: 'failed', failure: draftFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

type ProductMediaSnapshot = {
  images: SellerProductImage[];
  isPublished: boolean;
  moderationStatus: string;
  moderationNote: string | null;
  videos?: readonly unknown[];
  certificates?: readonly unknown[];
};

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
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
