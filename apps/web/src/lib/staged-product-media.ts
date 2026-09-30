import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
  PRODUCT_VIDEO_MAX_BYTES,
  isProductImageMimeType,
  isProductVideoMimeType,
} from '@agrobridge/shared';

export type StagedPhoto = {
  clientId: string;
  file: File;
  previewUrl: string;
  /** Set after a successful POST to the existing image endpoint. */
  uploadedImageId?: string;
};

export type StagedVideo = {
  clientId: string;
  file: File;
  previewUrl: string;
  /** Set after a successful POST to the existing video endpoint. */
  uploadedVideoId?: string;
};

export type StagedFileIssue = 'type' | 'size' | null;

const IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXTENSION = /\.(mp4|webm|mov)$/i;

export function stagedImageIssue(file: { name: string; type: string; size: number }): StagedFileIssue {
  if (file.type) {
    if (!isProductImageMimeType(file.type)) return 'type';
  } else if (!IMAGE_EXTENSION.test(file.name)) {
    return 'type';
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return 'size';
  return null;
}

export function stagedVideoIssue(file: { name: string; type: string; size: number }): StagedFileIssue {
  if (file.type) {
    if (!isProductVideoMimeType(file.type)) return 'type';
  } else if (!VIDEO_EXTENSION.test(file.name)) {
    return 'type';
  }
  if (file.size > PRODUCT_VIDEO_MAX_BYTES) return 'size';
  return null;
}

export function addStagedPhotos(
  photos: StagedPhoto[],
  coverClientId: string | null,
  incoming: StagedPhoto[],
): { photos: StagedPhoto[]; coverClientId: string | null; overflow: number } {
  const room = Math.max(0, PRODUCT_IMAGE_MAX_COUNT - photos.length);
  const accepted = incoming.slice(0, room);
  const next = [...photos, ...accepted];
  return {
    photos: next,
    coverClientId: coverClientId && next.some((photo) => photo.clientId === coverClientId)
      ? coverClientId
      : (next[0]?.clientId ?? null),
    overflow: incoming.length - accepted.length,
  };
}

export function removeStagedPhoto(
  photos: StagedPhoto[],
  coverClientId: string | null,
  clientId: string,
): { photos: StagedPhoto[]; coverClientId: string | null } {
  const next = photos.filter((photo) => photo.clientId !== clientId);
  const cover =
    coverClientId && next.some((photo) => photo.clientId === coverClientId)
      ? coverClientId
      : (next[0]?.clientId ?? null);
  return { photos: next, coverClientId: cover };
}

export function moveStagedPhoto(
  photos: StagedPhoto[],
  clientId: string,
  direction: -1 | 1,
): StagedPhoto[] {
  const index = photos.findIndex((photo) => photo.clientId === clientId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= photos.length) return photos;
  const next = photos.slice();
  const [item] = next.splice(index, 1);
  if (!item) return photos;
  next.splice(target, 0, item);
  return next;
}

export function selectStagedCover(photos: StagedPhoto[], clientId: string): string | null {
  return photos.some((photo) => photo.clientId === clientId) ? clientId : null;
}

export function revokePreviewUrl(
  url: string,
  revoke: (url: string) => void = URL.revokeObjectURL,
): void {
  revoke(url);
}

/** Drops one staged photo and revokes only that preview. */
export function discardStagedPhoto(
  photos: StagedPhoto[],
  coverClientId: string | null,
  photo: StagedPhoto,
  revoke: (url: string) => void = URL.revokeObjectURL,
): { photos: StagedPhoto[]; coverClientId: string | null } {
  revokePreviewUrl(photo.previewUrl, revoke);
  return removeStagedPhoto(photos, coverClientId, photo.clientId);
}

/** Revokes every preview still held when the staged-media UI unmounts. */
export function revokeStagedPreviews(
  photos: Array<{ previewUrl: string }>,
  video: { previewUrl: string } | null,
  revoke: (url: string) => void = URL.revokeObjectURL,
): void {
  for (const photo of photos) revokePreviewUrl(photo.previewUrl, revoke);
  if (video) revokePreviewUrl(video.previewUrl, revoke);
}

type UploadedImage = { id: string; isPrimary?: boolean };
type UploadedVideo = { id: string };
type MediaResponse = { images?: UploadedImage[]; videos?: UploadedVideo[]; message?: string };

function newImageId(knownIds: Set<string>, images: UploadedImage[] | undefined): string | null {
  return images?.find((image) => !knownIds.has(image.id))?.id ?? null;
}

export type StagedUploadResult = {
  photos: StagedPhoto[];
  video: StagedVideo | null;
  failedPhotoClientIds: string[];
  videoFailed: boolean;
  coverPersisted: boolean;
};

/**
 * Uploads staged files with the existing product image and video endpoints.
 * Already uploaded files are skipped. This function never publishes the product.
 */
export async function uploadStagedProductMedia(args: {
  productId: string;
  photos: StagedPhoto[];
  coverClientId: string | null;
  video: StagedVideo | null;
  fetchImpl?: typeof fetch;
}): Promise<StagedUploadResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const photos = args.photos.map((photo) => ({ ...photo }));
  let video = args.video ? { ...args.video } : null;
  const failedPhotoClientIds: string[] = [];
  const knownIds = new Set(
    photos.map((photo) => photo.uploadedImageId).filter((id): id is string => Boolean(id)),
  );
  let latestImages: UploadedImage[] = [];

  for (const photo of photos) {
    if (photo.uploadedImageId) continue;
    const body = new FormData();
    body.append('file', photo.file);
    body.append('kind', 'overview');
    try {
      const response = await fetchImpl(`/api/products/${args.productId}/images`, {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as MediaResponse;
      const imageId = newImageId(knownIds, data.images);
      if (!response.ok || !imageId) {
        failedPhotoClientIds.push(photo.clientId);
        continue;
      }
      photo.uploadedImageId = imageId;
      knownIds.add(imageId);
      latestImages = data.images ?? latestImages;
    } catch {
      failedPhotoClientIds.push(photo.clientId);
    }
  }

  const cover = photos.find((photo) => photo.clientId === args.coverClientId) ?? photos[0] ?? null;
  let coverPersisted = cover == null;
  if (cover?.uploadedImageId && !failedPhotoClientIds.includes(cover.clientId)) {
    const alreadyPrimary =
      latestImages.find((image) => image.id === cover.uploadedImageId)?.isPrimary === true;
    if (alreadyPrimary) {
      coverPersisted = true;
    } else {
      try {
        const response = await fetchImpl(
          `/api/products/${args.productId}/images/${cover.uploadedImageId}/primary`,
          { method: 'PATCH' },
        );
        coverPersisted = response.ok;
        if (!response.ok) failedPhotoClientIds.push(cover.clientId);
      } catch {
        failedPhotoClientIds.push(cover.clientId);
      }
    }
  }

  let videoFailed = false;
  if (video && !video.uploadedVideoId) {
    const knownVideoIds = new Set<string>();
    const body = new FormData();
    body.append('file', video.file);
    try {
      const response = await fetchImpl(`/api/products/${args.productId}/videos`, {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as MediaResponse;
      const videoId = data.videos?.find((item) => !knownVideoIds.has(item.id))?.id ?? null;
      if (response.ok && videoId) {
        video = { ...video, uploadedVideoId: videoId };
      } else {
        videoFailed = true;
      }
    } catch {
      videoFailed = true;
    }
  }

  return { photos, video, failedPhotoClientIds, videoFailed, coverPersisted };
}
