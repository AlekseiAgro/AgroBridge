'use client';

import { FARM_PHOTO_MAX_COUNT, type FarmDetail, type FarmPhoto } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toPublicMediaUrl } from '@/lib/product-image';

type Props = {
  initialPhotos: FarmPhoto[];
};

export function FarmPhotosManager({ initialPhotos }: Props) {
  const t = useTranslations('farm');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initialPhotos);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refreshFrom(farm: FarmDetail) {
    setPhotos(farm.photos);
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
      const response = await fetch('/api/farms/me/photos', {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as FarmDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('photos.uploadError'));
        return;
      }
      await refreshFrom(data);
    } catch {
      setError(t('photos.uploadError'));
    } finally {
      setPending(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  async function onDelete(photoId: string) {
    if (!window.confirm(t('photos.deleteConfirm'))) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/farms/me/photos/${photoId}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as FarmDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('photos.deleteError'));
        return;
      }
      await refreshFrom(data);
    } catch {
      setError(t('photos.deleteError'));
    } finally {
      setPending(false);
    }
  }

  async function onSetPrimary(photoId: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/farms/me/photos/${photoId}/primary`, {
        method: 'PATCH',
      });
      const data = (await response.json()) as FarmDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('photos.primaryError'));
        return;
      }
      await refreshFrom(data);
    } catch {
      setError(t('photos.primaryError'));
    } finally {
      setPending(false);
    }
  }

  const canUpload = photos.length < FARM_PHOTO_MAX_COUNT;

  return (
    <section className="product-images" style={{ marginTop: '2rem' }}>
      <div className="product-images__header">
        <h2 className="section-title">{t('photos.title')}</h2>
        <p className="page__subtitle">{t('photos.subtitle', { max: FARM_PHOTO_MAX_COUNT })}</p>
      </div>

      {photos.length > 0 ? (
        <ul className="product-images__grid">
          {photos.map((photo) => (
            <li key={photo.id} className="product-images__item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toPublicMediaUrl(photo.url)} alt="" className="product-images__thumb" />
              <div className="product-images__meta">
                {photo.isPrimary ? (
                  <span className="product-images__badge">{t('photos.primary')}</span>
                ) : (
                  <button
                    type="button"
                    className="button button--ghost"
                    disabled={pending}
                    onClick={() => void onSetPrimary(photo.id)}
                  >
                    {t('photos.setPrimary')}
                  </button>
                )}
                <button
                  type="button"
                  className="button button--ghost"
                  disabled={pending}
                  onClick={() => void onDelete(photo.id)}
                >
                  {t('photos.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{t('photos.empty')}</p>
      )}

      {canUpload ? (
        <label className="product-images__upload">
          <span className="button button--primary">
            {pending ? t('pleaseWait') : t('photos.upload')}
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
        <p className="product-list__meta">
          {t('photos.maxReached', { max: FARM_PHOTO_MAX_COUNT })}
        </p>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
