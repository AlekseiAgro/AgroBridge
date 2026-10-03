'use client';

import { PRODUCT_IMAGE_MAX_COUNT, type ProductDetail, type ProductImage } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toPublicMediaUrl } from '@/lib/product-image';
import { canAddProductPhotos, planProductPhotoSelection, remainingPhotoSlots } from '@/lib/product-photos';

type Props = {
  productId: string;
  initialImages: ProductImage[];
  embedded?: boolean;
};

export function ProductImagesManager({ productId, initialImages, embedded = false }: Props) {
  const t = useTranslations('product');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [images, setImages] = useState(initialImages);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refreshFrom(product: ProductDetail) {
    setImages(product.images);
    router.refresh();
  }

  async function onUpload(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    const plan = planProductPhotoSelection(images.length, files);
    const notices = plan.notices.map((notice) =>
      notice === 'type'
        ? t('images.fileType')
        : notice === 'size'
          ? t('images.fileTooLarge')
          : t('images.onlyRemaining', { count: plan.remaining }),
    );
    if (plan.accepted.length === 0) {
      setError(notices.join(' ') || null);
      return;
    }

    setPending(true);
    setError(notices.length > 0 ? notices.join(' ') : null);
    let latest: ProductDetail | null = null;
    let failed = false;

    for (const file of plan.accepted) {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', 'overview');
      try {
        const response = await fetch(`/api/products/${productId}/images`, {
          method: 'POST',
          body,
        });
        const data = (await response.json()) as ProductDetail & { message?: string };
        if (!response.ok) {
          failed = true;
          notices.push(data.message ?? t('images.uploadError'));
          continue;
        }
        latest = data;
      } catch {
        failed = true;
        notices.push(t('images.uploadError'));
      }
    }

    if (latest) await refreshFrom(latest);
    if (failed || notices.length > 0) setError(notices.join(' '));
    setPending(false);
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
      const response = await fetch(`/api/products/${productId}/images/${imageId}/primary`, {
        method: 'PATCH',
      });
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

  const canUpload = canAddProductPhotos(images.length);
  const addLabel = remainingPhotoSlots(images.length) === 1 ? t('images.addPhoto') : t('images.addPhotos');

  const HeadingTag = embedded ? 'h3' : 'h2';

  return (
    <section
      className={
        embedded
          ? 'product-images product-media-block'
          : 'product-images product-form__section'
      }
    >
      <div className="product-images__header">
        <HeadingTag className={embedded ? 'product-form__subheading' : 'section-title'}>
          {t('images.title')}
        </HeadingTag>
        <p className="page__subtitle">{t('images.subtitle', { max: PRODUCT_IMAGE_MAX_COUNT })}</p>
        {images.length > 0 ? <p className="field-hint">{t('images.coverHint')}</p> : null}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={pending || !canUpload}
        onChange={(event) => void onUpload(event.target.files)}
      />

      {images.length === 0 && canUpload ? (
        <label htmlFor={inputId} className="product-images__drop" aria-label={t('images.addPhotosLabel')}>
          <span>{pending ? t('pleaseWait') : addLabel}</span>
        </label>
      ) : null}

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
          {canUpload ? (
            <li>
              <label htmlFor={inputId} className="product-images__add" aria-label={t('images.addPhotosLabel')}>
                <span aria-hidden="true">{pending ? '…' : '+'}</span>
                <span className="sr-only">{pending ? t('pleaseWait') : addLabel}</span>
              </label>
            </li>
          ) : null}
        </ul>
      ) : null}

      {canUpload ? null : (
        <p className="product-list__meta">
          {t('images.maxReached', { max: PRODUCT_IMAGE_MAX_COUNT })}
        </p>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
