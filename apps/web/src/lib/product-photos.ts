import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
  isProductImageMimeType,
} from '@agrobridge/shared';

const IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;

/** Same JPEG/PNG/WebP and 5 MB rules as the staged uploader. */
function imageIssue(file: PhotoCandidate): 'type' | 'size' | null {
  if (file.type) {
    if (!isProductImageMimeType(file.type)) return 'type';
  } else if (!IMAGE_EXTENSION.test(file.name)) {
    return 'type';
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return 'size';
  return null;
}

export type PhotoCandidate = {
  name: string;
  type: string;
  size: number;
};

export type PhotoSelectionNotice = 'type' | 'size' | 'overflow';

export type PhotoSelectionPlan = {
  remaining: number;
  accepted: PhotoCandidate[];
  rejectedType: PhotoCandidate[];
  rejectedSize: PhotoCandidate[];
  overflow: PhotoCandidate[];
  notices: PhotoSelectionNotice[];
};

/** Slots left under the existing five-photo product limit. */
export function remainingPhotoSlots(existingCount: number): number {
  return Math.max(0, PRODUCT_IMAGE_MAX_COUNT - Math.max(0, existingCount));
}

export function canAddProductPhotos(existingCount: number): boolean {
  return remainingPhotoSlots(existingCount) > 0;
}

/**
 * Validates a picker selection against the existing type, size, and count rules.
 * Extra files are reported and are not included in `accepted`.
 */
export function planProductPhotoSelection<T extends PhotoCandidate>(
  existingCount: number,
  files: T[],
): Omit<PhotoSelectionPlan, 'accepted' | 'rejectedType' | 'rejectedSize' | 'overflow'> & {
  accepted: T[];
  rejectedType: T[];
  rejectedSize: T[];
  overflow: T[];
} {
  const remaining = remainingPhotoSlots(existingCount);
  const rejectedType: T[] = [];
  const rejectedSize: T[] = [];
  const valid: T[] = [];

  for (const file of files) {
    const issue = imageIssue(file);
    if (issue === 'type') {
      rejectedType.push(file);
    } else if (issue === 'size') {
      rejectedSize.push(file);
    } else {
      valid.push(file);
    }
  }

  const accepted = valid.slice(0, remaining);
  const overflow = valid.slice(remaining);
  const notices: PhotoSelectionNotice[] = [];
  if (rejectedType.length > 0) notices.push('type');
  if (rejectedSize.length > 0) notices.push('size');
  if (overflow.length > 0) notices.push('overflow');

  return { remaining, accepted, rejectedType, rejectedSize, overflow, notices };
}

/** Owner-only path to the existing product editor. Non-owners get no route. */
export function ownerProductEditPath(isOwner: boolean, productId: string): string | null {
  const id = productId.trim();
  if (!isOwner || !id) return null;
  return `/dashboard/products/${id}/edit`;
}
