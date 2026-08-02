'use client';

import {
  PRODUCT_IMAGE_MAX_COUNT,
  type ProductDetail,
  type ProductImage,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useRef, useState } from 'react';

type Props = {
  productId: string;
  initialImages: ProductImage[];
};

export function ProductImagesManager({ productId, initialImages }: Props) {
  const t = useTranslations('product');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(initialImages);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refreshFrom(product: ProductDetail) {
    setImages(product.images);
    router.refresh();
  }

  async function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setPending(true);
    setError(null);

    const body = new FormData();
    body.append('file', file);

    try {
      const response = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('images.uploadError'));
        return;
      }
      await refreshFrom(data);
    } catch {
      setError(t('images.uploadError'));
    } finally {
      setPending(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  async function onDelete(imageId: string) {
    if (!window.confirm(t('images.deleteConfirm'))) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/images/${imageId}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('images.deleteError'));
        return;
      }
      await refreshFrom(data);
    } catch {
      setError(t('images.deleteError'));
    } finally {
      setPending(false);
    }
  }

  async function onSetPrimary(imageId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/products/${productId}/images/${imageId}/primary`,
        { method: 'PATCH' },
      );
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('images.primaryError'));
        return;
      }
      await refreshFrom(data);
    } catch {
      setError(t('images.primaryError'));
    } finally {
      setPending(false);
    }
  }

  const canUpload = images.length < PRODUCT_IMAGE_MAX_COUNT;

  return (
    <section className="product-images">
      <div className="product-images__header">
        <h2 className="section-title">{t('images.title')}</h2>
        <p className="page__subtitle">{t('images.subtitle', { max: PRODUCT_IMAGE_MAX_COUNT })}</p>
      </div>

      {images.length > 0 ? (
        <ul className="product-images__grid">
          {images.map((image) => (
            <li key={image.id} className="product-images__item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toPublicMediaUrl(image.url)} alt="" className="product-images__thumb" />
              <div className="product-images__meta">
                {image.isPrimary ? (
                  <span className="product-images__badge">{t('images.primary')}</span>
                ) : (
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={pending}
                    onClick={() => void onSetPrimary(image.id)}
                  >
                    {t('images.setPrimary')}
                  </button>
                )}
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={pending}
                  onClick={() => void onDelete(image.id)}
                >
                  {t('images.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{t('images.empty')}</p>
      )}

      {canUpload ? (
        <label className="product-images__upload">
          <span className="button button--primary">
            {pending ? t('pleaseWait') : t('images.upload')}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            onChange={(event) => void onUpload(event.target.files)}
          />
        </label>
      ) : (
        <p className="product-list__meta">{t('images.maxReached', { max: PRODUCT_IMAGE_MAX_COUNT })}</p>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
