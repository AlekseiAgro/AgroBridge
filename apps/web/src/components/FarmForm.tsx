'use client';

import {
  FARM_PHOTO_MAX_BYTES,
  FARM_PHOTO_MAX_COUNT,
  GEORGIA_REGIONS,
  isFarmPhotoMimeType,
  isGeorgiaRegion,
  type FarmDetail,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';

type Props = {
  initial?: Pick<
    FarmDetail,
    | 'name'
    | 'region'
    | 'description'
    | 'foundedYear'
    | 'farmSizeHectares'
    | 'ownershipType'
    | 'exportMarkets'
    | 'history'
  > | null;
  mode: 'create' | 'edit';
};

type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

export function FarmForm({ initial, mode }: Props) {
  const t = useTranslations('farm');
  const tr = useTranslations();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const photosInputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  function addPhotos(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setError(null);
    const remaining = FARM_PHOTO_MAX_COUNT - photos.length;
    if (remaining <= 0) {
      setError(t('photos.maxReached', { max: FARM_PHOTO_MAX_COUNT }));
      return;
    }

    const next: PendingPhoto[] = [];
    for (const file of Array.from(fileList).slice(0, remaining)) {
      if (!isFarmPhotoMimeType(file.type)) {
        setError(t('photos.uploadError'));
        continue;
      }
      if (file.size > FARM_PHOTO_MAX_BYTES) {
        setError(t('photos.uploadError'));
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (next.length > 0) {
      setPhotos((current) => [...current, ...next]);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === photoId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  async function uploadPendingPhotos(files: File[]) {
    for (const file of files) {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/farms/me/photos', {
        method: 'POST',
        body,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? t('photos.uploadError'));
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const foundedYearRaw = String(form.get('foundedYear') ?? '').trim();
    const farmSizeRaw = String(form.get('farmSizeHectares') ?? '').trim();
    const payload = {
      name: String(form.get('name') ?? ''),
      region: String(form.get('region') ?? ''),
      description: String(form.get('description') ?? ''),
      foundedYear: foundedYearRaw ? Number(foundedYearRaw) : undefined,
      farmSizeHectares: farmSizeRaw ? Number(farmSizeRaw) : undefined,
      ownershipType: String(form.get('ownershipType') ?? '').trim(),
      exportMarkets: [
        ...new Set(
          String(form.get('exportMarkets') ?? '')
            .split(',')
            .map((market) => market.trim())
            .filter(Boolean),
        ),
      ],
      history: String(form.get('history') ?? '').trim(),
    };

    try {
      const response = await fetch(mode === 'create' ? '/api/farms' : '/api/farms/me', {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('genericError'));
        return;
      }

      if (mode === 'create' && photos.length > 0) {
        try {
          await uploadPendingPhotos(photos.map((photo) => photo.file));
        } catch (uploadError) {
          setError(
            uploadError instanceof Error ? uploadError.message : t('photos.uploadError'),
          );
          router.replace('/dashboard/farm');
          router.refresh();
          return;
        }
      }

      router.replace('/dashboard/farm');
      router.refresh();
    } catch {
      setError(t('genericError'));
    } finally {
      setPending(false);
    }
  }

  const canAddPhotos = mode === 'create' && photos.length < FARM_PHOTO_MAX_COUNT;

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span>{t('name')}</span>
        <input name="name" required minLength={2} defaultValue={initial?.name ?? ''} />
      </label>
      <label className="field">
        <span>{t('region')}</span>
        <select name="region" defaultValue={initial?.region ?? ''}>
          <option value="">{t('regionPlaceholder')}</option>
          {initial?.region && !isGeorgiaRegion(initial.region) ? (
            <option value={initial.region}>{initial.region}</option>
          ) : null}
          {GEORGIA_REGIONS.map((value) => (
            <option key={value} value={value}>
              {tr(`regions.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('description')}</span>
        <textarea name="description" rows={5} defaultValue={initial?.description ?? ''} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t('foundedYear')}</span>
          <input
            name="foundedYear"
            type="number"
            min={1800}
            max={2200}
            step={1}
            defaultValue={initial?.foundedYear ?? ''}
          />
        </label>
        <label className="field">
          <span>{t('farmSizeHectares')}</span>
          <input
            name="farmSizeHectares"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial?.farmSizeHectares ?? ''}
          />
        </label>
      </div>
      <label className="field">
        <span>{t('ownershipType')}</span>
        <input name="ownershipType" defaultValue={initial?.ownershipType ?? ''} />
      </label>
      <label className="field">
        <span>{t('exportMarkets')}</span>
        <input
          name="exportMarkets"
          defaultValue={(initial?.exportMarkets ?? []).join(', ')}
          placeholder={t('exportMarketsPlaceholder')}
        />
      </label>
      <label className="field">
        <span>{t('history')}</span>
        <textarea name="history" rows={6} defaultValue={initial?.history ?? ''} />
      </label>

      {mode === 'create' ? (
        <section className="farm-form-photos" aria-labelledby={photosInputId}>
          <div className="product-images__header">
            <h2 id={photosInputId} className="section-title">
              {t('photos.title')}
            </h2>
            <p className="page__subtitle">{t('photos.subtitle', { max: FARM_PHOTO_MAX_COUNT })}</p>
          </div>

          {photos.length > 0 ? (
            <ul className="product-images__grid">
              {photos.map((photo, index) => (
                <li key={photo.id} className="product-images__item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt="" className="product-images__thumb" />
                  <div className="product-images__meta">
                    {index === 0 ? (
                      <span className="product-images__badge">{t('photos.primary')}</span>
                    ) : null}
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={pending}
                      onClick={() => removePhoto(photo.id)}
                    >
                      {t('photos.delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">{t('photos.formEmpty')}</p>
          )}

          {canAddPhotos ? (
            <label className="product-images__upload">
              <span className="button button--ghost">{t('photos.upload')}</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={pending}
                onChange={(event) => addPhotos(event.target.files)}
              />
            </label>
          ) : (
            <p className="product-list__meta">
              {t('photos.maxReached', { max: FARM_PHOTO_MAX_COUNT })}
            </p>
          )}
        </section>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? t('pleaseWait') : mode === 'create' ? t('createSubmit') : t('saveSubmit')}
      </button>
    </form>
  );
}
