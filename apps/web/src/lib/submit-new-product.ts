import { publicationBlockedForMissingPhoto } from '@agrobridge/shared';
import {
  uploadStagedProductMedia,
  type StagedPhoto,
  type StagedVideo,
} from './staged-product-media';

export type CreateProductSession = {
  productId: string | null;
  locked: boolean;
};

export type NewProductIntent = 'save' | 'publish';

export type SubmitNewProductArgs = {
  intent: NewProductIntent;
  payload: Record<string, unknown>;
  photos: StagedPhoto[];
  coverClientId: string | null;
  video: StagedVideo | null;
};

export type SubmitNewProductStatus =
  | 'ignored'
  | 'photo-required'
  | 'request-failed'
  | 'missing-id'
  | 'media-failed'
  | 'saved'
  | 'published';

export type SubmitNewProductResult = {
  status: SubmitNewProductStatus;
  productId: string | null;
  photos: StagedPhoto[];
  video: StagedVideo | null;
  message?: string;
};

type JsonBody = { message?: string; id?: string };

/**
 * Creates one draft, uploads staged media, then publishes only after every
 * selected upload succeeds. A later call reuses session.productId.
 */
export async function submitNewProduct(
  session: CreateProductSession,
  args: SubmitNewProductArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitNewProductResult> {
  if (session.locked) {
    return {
      status: 'ignored',
      productId: session.productId,
      photos: args.photos,
      video: args.video,
    };
  }
  session.locked = true;

  try {
    if (
      args.intent === 'publish' &&
      publicationBlockedForMissingPhoto({
        nextPublished: true,
        previousPublished: false,
        photoCount: args.photos.length,
      })
    ) {
      session.locked = false;
      return {
        status: 'photo-required',
        productId: session.productId,
        photos: args.photos,
        video: args.video,
      };
    }

    const existingId = session.productId;
    const creating = !existingId;
    const response = await fetchImpl(creating ? '/api/products' : `/api/products/${existingId}`, {
      method: creating ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...args.payload, isPublished: false }),
    });
    const data = (await response.json()) as JsonBody;
    if (!response.ok) {
      session.locked = false;
      return {
        status: 'request-failed',
        productId: session.productId,
        photos: args.photos,
        video: args.video,
        message: data.message,
      };
    }

    const productId = creating ? data.id : existingId;
    if (!productId) {
      session.locked = false;
      return {
        status: 'missing-id',
        productId: session.productId,
        photos: args.photos,
        video: args.video,
      };
    }
    session.productId = productId;

    const uploaded = await uploadStagedProductMedia({
      productId,
      photos: args.photos,
      coverClientId: args.coverClientId,
      video: args.video,
      fetchImpl,
    });
    if (uploaded.failedPhotoClientIds.length > 0 || uploaded.videoFailed || !uploaded.coverPersisted) {
      session.locked = false;
      return {
        status: 'media-failed',
        productId,
        photos: uploaded.photos,
        video: uploaded.video,
      };
    }

    if (args.intent === 'publish') {
      const published = await fetchImpl(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: true }),
      });
      const publishedData = (await published.json()) as JsonBody;
      if (!published.ok) {
        session.locked = false;
        return {
          status: 'request-failed',
          productId,
          photos: uploaded.photos,
          video: uploaded.video,
          message: publishedData.message,
        };
      }
      return {
        status: 'published',
        productId,
        photos: uploaded.photos,
        video: uploaded.video,
      };
    }

    return {
      status: 'saved',
      productId,
      photos: uploaded.photos,
      video: uploaded.video,
    };
  } catch (error) {
    session.locked = false;
    throw error;
  }
}
