'use client';

import type { FarmPhoto } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { toPublicMediaUrl } from '@/lib/product-image';

type Props = {
  farmName: string;
  cover: FarmPhoto;
  extraPhotos: FarmPhoto[];
};

/**
 * Compact farm cover plus clickable extra thumbnails. Extra photos open in a native
 * dialog so buyers can see them at a useful size without restoring the old gallery.
 */
export function FarmCoverPhotos({ farmName, cover, extraPhotos }: Props) {
  const t = useTranslations('farm.photos');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [active, setActive] = useState<FarmPhoto | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onBackdropClick(event: MouseEvent) {
      if (event.target === dialogRef.current) {
        dialogRef.current?.close();
      }
    }
    function onClose() {
      setActive(null);
    }

    dialog.addEventListener('click', onBackdropClick);
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('click', onBackdropClick);
      dialog.removeEventListener('close', onClose);
    };
  }, []);

  function openPhoto(photo: FarmPhoto) {
    setActive(photo);
    dialogRef.current?.showModal();
  }

  function closePhoto() {
    dialogRef.current?.close();
  }

  return (
    <div className="farm-profile__cover">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={toPublicMediaUrl(cover.url)}
        alt={farmName}
        className="farm-profile__cover-image"
      />
      {extraPhotos.length > 0 ? (
        <div className="farm-profile__cover-thumbs">
          {extraPhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="farm-profile__cover-thumb-button"
              onClick={() => openPhoto(photo)}
              aria-label={t('openPhoto', { name: farmName, index: index + 2 })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toPublicMediaUrl(photo.url)} alt="" className="farm-profile__cover-thumb" />
            </button>
          ))}
        </div>
      ) : null}

      <dialog ref={dialogRef} className="farm-photo-dialog" aria-labelledby={titleId}>
        <div className="farm-photo-dialog__card">
          <div className="farm-photo-dialog__head">
            <h2 id={titleId} className="section-title">
              {t('viewerTitle')}
            </h2>
            <button type="button" className="button button--ghost" onClick={closePhoto}>
              {t('closeViewer')}
            </button>
          </div>
          {active ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={toPublicMediaUrl(active.url)}
              alt={farmName}
              className="farm-photo-dialog__image"
            />
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
