import { ApiError } from '../api/errors';
import { resolveMediaUrl } from '../api/media-url';
import { draftFailure, type DraftFailure, type DraftGate } from './draft';
import { multipartFileValue, type ProductPhotoFile } from './photos';

/** Mirrors the API: one public video, MP4, WebM, or QuickTime, 80 MB. */
export const PRODUCT_VIDEO_MAX_COUNT = 1;
export const PRODUCT_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const PRODUCT_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const PRODUCT_VIDEO_FIELD = 'file';

export type ProductVideoMimeType = (typeof PRODUCT_VIDEO_MIME_TYPES)[number];

export type SellerProductVideo = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number | null;
};

export type ProductVideoFile = ProductPhotoFile;

export type VideoIssue = 'unsupported' | 'tooLarge' | 'missingFile' | 'maxReached';

export type VideoFailure = DraftFailure | 'notFound' | 'conflict';

export type VideoChoice = 'cancel' | 'confirm';

export type VideoSubmitResult<T> =
  | { status: 'ignored' }
  | { status: 'cancelled' }
  | { status: 'invalid'; issue: VideoIssue }
  | { status: 'uploaded'; product: T }
  | { status: 'replaced'; product: T }
  | { status: 'deleted'; product: T }
  | { status: 'failed'; failure: VideoFailure; product?: T };

const MIME_TYPES: readonly string[] = PRODUCT_VIDEO_MIME_TYPES;

const EXTENSION_MIME: Record<string, ProductVideoMimeType> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

export function productVideoUploadPath(productId: string): string {
  return `/products/${productId}/videos`;
}

export function productVideoDeletePath(productId: string, videoId: string): string {
  return `/products/${productId}/videos/${videoId}`;
}

export function videoUploadBlocked(count: number): boolean {
  return count >= PRODUCT_VIDEO_MAX_COUNT;
}

export function normalizeVideoMime(mimeType: string | null | undefined): string | null {
  if (!mimeType) {
    return null;
  }
  const mime = mimeType.trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') {
    return null;
  }
  if (mime === 'video/mov' || mime === 'video/x-quicktime') {
    return 'video/quicktime';
  }
  return mime;
}

export function videoMimeFromName(name: string): ProductVideoMimeType | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!match?.[1]) {
    return null;
  }
  return EXTENSION_MIME[match[1].toLowerCase()] ?? null;
}

/** Identifies MP4, QuickTime, or WebM from file bytes. Other content is unsupported. */
export function classifyVideoBytes(bytes: Uint8Array): ProductVideoMimeType | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== 'ftyp') {
    return null;
  }
  return ascii(bytes, 8, 4) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
}

/**
 * The declared type wins when it is usable. A missing or generic type falls back to the file name.
 * A declared type the API does not accept is not overridden by the name.
 */
export function resolveVideoMime(file: Pick<ProductVideoFile, 'name' | 'mimeType'>): ProductVideoMimeType | null {
  const declared = normalizeVideoMime(file.mimeType);
  if (declared) {
    return MIME_TYPES.includes(declared) ? (declared as ProductVideoMimeType) : null;
  }
  return videoMimeFromName(file.name);
}

export function videoFileIssue(file: ProductVideoFile): VideoIssue | null {
  if (!file.uri.trim()) {
    return 'missingFile';
  }
  if (!resolveVideoMime(file)) {
    return 'unsupported';
  }
  const size = knownFileSize(file.fileSize);
  if (size != null && size > PRODUCT_VIDEO_MAX_BYTES) {
    return 'tooLarge';
  }
  return null;
}

export function parseProductVideos(value: unknown): SellerProductVideo[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const videos: SellerProductVideo[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    const fileName = typeof row.fileName === 'string' ? row.fileName.trim() : '';
    if (!id || !url || !fileName) {
      continue;
    }
    const duration = row.durationSeconds;
    videos.push({
      id,
      url,
      fileName,
      mimeType: typeof row.mimeType === 'string' ? row.mimeType : '',
      durationSeconds: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    });
  }
  return videos;
}

export function publicVideoUrl(url: string, apiBaseUrl: string): string | null {
  const resolved = resolveMediaUrl(url, apiBaseUrl);
  if (!resolved || !/^https?:\/\//i.test(resolved)) {
    return null;
  }
  return resolved;
}

export function fillProductVideoForm(form: FormData, file: ProductVideoFile, native = isReactNative()): void {
  form.append(
    PRODUCT_VIDEO_FIELD,
    multipartFileValue({ ...file, mimeType: resolveVideoMime(file) }, native, MIME_TYPES) as Blob,
  );
}

export function videoFailure(error: unknown): VideoFailure {
  if (error instanceof ApiError && error.status === 404) {
    return 'notFound';
  }
  if (error instanceof ApiError && error.status === 409) {
    return 'conflict';
  }
  return draftFailure(error);
}

/** Uploads the only video. A second video is rejected locally because the API allows one. */
export async function submitProductVideoUpload<T>(options: {
  productId: string;
  file: ProductVideoFile;
  currentCount: number;
  gate: DraftGate;
  upload: (productId: string, file: ProductVideoFile) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<VideoSubmitResult<T>> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  if (videoUploadBlocked(options.currentCount)) {
    return { status: 'invalid', issue: 'maxReached' };
  }
  const issue = videoFileIssue(options.file);
  if (issue) {
    return { status: 'invalid', issue };
  }
  options.gate.pending = true;
  options.onPending(true);
  try {
    const product = await options.upload(options.productId, options.file);
    return { status: 'uploaded', product };
  } catch (error) {
    return { status: 'failed', failure: videoFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

/**
 * The API rejects a second video, so replacement deletes the current one and then uploads.
 * Cancel leaves the current video in place. A failed upload after a successful delete
 * returns the product from that delete.
 */
export async function submitProductVideoReplace<T>(options: {
  productId: string;
  file: ProductVideoFile;
  existingVideoId: string;
  ask: () => Promise<VideoChoice>;
  gate: DraftGate;
  remove: (productId: string, videoId: string) => Promise<T>;
  upload: (productId: string, file: ProductVideoFile) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<VideoSubmitResult<T>> {
  if (options.gate.pending) {
    return { status: 'ignored' };
  }
  const issue = videoFileIssue(options.file);
  if (issue) {
    return { status: 'invalid', issue };
  }
  options.gate.pending = true;
  try {
    const choice = await options.ask();
    if (choice !== 'confirm') {
      return { status: 'cancelled' };
    }
    options.onPending(true);
    let cleared: T | undefined;
    try {
      cleared = await options.remove(options.productId, options.existingVideoId);
      const product = await options.upload(options.productId, options.file);
      return { status: 'replaced', product };
    } catch (error) {
      return { status: 'failed', failure: videoFailure(error), ...(cleared ? { product: cleared } : {}) };
    }
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export async function submitProductVideoDelete<T>(options: {
  productId: string;
  videoId: string;
  ask: () => Promise<VideoChoice>;
  gate: DraftGate;
  remove: (productId: string, videoId: string) => Promise<T>;
  onPending: (pending: boolean) => void;
}): Promise<VideoSubmitResult<T>> {
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
    const product = await options.remove(options.productId, options.videoId);
    return { status: 'deleted', product };
  } catch (error) {
    return { status: 'failed', failure: videoFailure(error) };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
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
