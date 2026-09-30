'use client';

import { PRODUCT_IMAGE_MAX_COUNT, PRODUCT_VIDEO_MAX_COUNT } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import {
  addStagedPhotos,
  discardStagedPhoto,
  moveStagedPhoto,
  revokePreviewUrl,
  revokeStagedPreviews,
  selectStagedCover,
  stagedImageIssue,
  stagedVideoIssue,
  type StagedPhoto,
  type StagedVideo,
} from '@/lib/staged-product-media';

type Props = {
  photos: StagedPhoto[];
  coverClientId: string | null;
  video: StagedVideo | null;
  disabled?: boolean;
  onPhotosChange: (photos: StagedPhoto[], coverClientId: string | null) => void;
  onVideoChange: (video: StagedVideo | null) => void;
  onRemoveUploadedPhoto?: (photo: StagedPhoto) => Promise<boolean>;
  onRemoveUploadedVideo?: (video: StagedVideo) => Promise<boolean>;
  onError: (message: string | null) => void;
};

function clientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `staged-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ProductStagedMedia({
  photos,
  coverClientId,
  video,
  disabled = false,
  onPhotosChange,
  onVideoChange,
  onRemoveUploadedPhoto,
  onRemoveUploadedVideo,
  onError,
}: Props) {
  const t = useTranslations('product');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoInputId = useId();
  const videoInputId = useId();
  const photosRef = useRef(photos);
  const videoRef = useRef(video);

  useEffect(() => {
    photosRef.current = photos;
    videoRef.current = video;
  }, [photos, video]);

  useEffect(() => {
    return () => {
      revokeStagedPreviews(photosRef.current, videoRef.current);
    };
  }, []);

  function addPhotos(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (files.length === 0) return;

    const accepted: StagedPhoto[] = [];
    for (const file of files) {
      const issue = stagedImageIssue(file);
      if (issue === 'type') {
        onError(t('images.fileType'));
        continue;
      }
      if (issue === 'size') {
        onError(t('images.fileTooLarge'));
        continue;
      }
      accepted.push({
        clientId: clientId(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (accepted.length === 0) return;
    const next = addStagedPhotos(photos, coverClientId, accepted);
    for (const photo of accepted.slice(accepted.length - next.overflow)) {
      revokePreviewUrl(photo.previewUrl);
    }
    if (next.overflow > 0) onError(t('images.maxReached', { max: PRODUCT_IMAGE_MAX_COUNT }));
    else onError(null);
    onPhotosChange(next.photos, next.coverClientId);
  }

  async function removePhoto(photo: StagedPhoto) {
    if (photo.uploadedImageId && onRemoveUploadedPhoto) {
      const removed = await onRemoveUploadedPhoto(photo);
      if (!removed) return;
    }
    const next = discardStagedPhoto(photos, coverClientId, photo);
    onPhotosChange(next.photos, next.coverClientId);
    onError(null);
  }

  async function replaceVideo(fileList: FileList | null) {
    const file = fileList?.[0];
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (!file) return;
    const issue = stagedVideoIssue(file);
    if (issue === 'type') {
      onError(t('videos.fileType'));
      return;
    }
    if (issue === 'size') {
      onError(t('videos.fileTooLarge'));
      return;
    }
    if (video?.uploadedVideoId && onRemoveUploadedVideo) {
      const removed = await onRemoveUploadedVideo(video);
      if (!removed) return;
    }
    if (video) revokePreviewUrl(video.previewUrl);
    onVideoChange({
      clientId: clientId(),
      file,
      previewUrl: URL.createObjectURL(file),
    });
    onError(null);
  }

  async function clearVideo() {
    if (!video) return;
    if (video.uploadedVideoId && onRemoveUploadedVideo) {
      const removed = await onRemoveUploadedVideo(video);
      if (!removed) return;
    }
    revokePreviewUrl(video.previewUrl);
    onVideoChange(null);
    onError(null);
  }

  return (
    <section className="product-form__section product-media-section">
      <h2 className="section-title">{t('formSections.media')}</h2>
      <div className="product-images product-media-block">
        <div className="product-images__header">
          <h3 className="product-form__subheading">{t('images.title')}</h3>
          <p className="page__subtitle">{t('images.subtitle', { max: PRODUCT_IMAGE_MAX_COUNT })}</p>
          {photos.length > 0 ? <p className="field-hint">{t('images.coverHint')}</p> : null}
        </div>
        {photos.length > 0 ? (
          <ul className="product-images__grid">
            {photos.map((photo, index) => {
              const isCover = photo.clientId === coverClientId;
              const orderLocked = photos.some((item) => item.uploadedImageId);
              return (
                <li key={photo.clientId} className="product-images__item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt="" className="product-images__thumb" />
                  <div className="product-images__meta">
                    {isCover ? (
                      <span className="product-images__badge">{t('images.primary')}</span>
                    ) : (
                      <button
                        type="button"
                        className="button button--ghost"
                        disabled={disabled}
                        onClick={() => {
                          const cover = selectStagedCover(photos, photo.clientId);
                          if (cover) onPhotosChange(photos, cover);
                        }}
                      >
                        {t('images.setPrimary')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button--ghost"
                        disabled={disabled || orderLocked || index === 0}
                      onClick={() => onPhotosChange(moveStagedPhoto(photos, photo.clientId, -1), coverClientId)}
                    >
                      {t('images.moveEarlier')}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                        disabled={disabled || orderLocked || index === photos.length - 1}
                      onClick={() => onPhotosChange(moveStagedPhoto(photos, photo.clientId, 1), coverClientId)}
                    >
                      {t('images.moveLater')}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={disabled}
                      onClick={() => void removePhoto(photo)}
                    >
                      {t('images.delete')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state">{t('images.empty')}</p>
        )}
        {photos.length < PRODUCT_IMAGE_MAX_COUNT ? (
          <label className="product-images__upload" htmlFor={photoInputId}>
            <span className="button button--primary">{t('images.upload')}</span>
            <input
              id={photoInputId}
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={disabled}
              onChange={(event) => addPhotos(event.target.files)}
            />
          </label>
        ) : (
          <p className="product-list__meta">{t('images.maxReached', { max: PRODUCT_IMAGE_MAX_COUNT })}</p>
        )}
      </div>
      <div className="product-images product-videos product-media-block product-media-block--secondary">
        <div className="product-images__header">
          <h3 className="product-form__subheading">{t('videos.optionalLabel')}</h3>
          <p className="page__subtitle">{t('videos.subtitle', { max: PRODUCT_VIDEO_MAX_COUNT })}</p>
        </div>
        {video ? (
          <ul className="product-images__grid">
            <li className="product-images__item">
              <video className="product-images__thumb" controls preload="metadata">
                <source src={video.previewUrl} />
              </video>
              <span className="product-list__meta">{video.file.name}</span>
              <button
                type="button"
                className="button button--ghost"
                disabled={disabled}
                onClick={() => void clearVideo()}
              >
                {t('videos.delete')}
              </button>
            </li>
          </ul>
        ) : (
          <p className="empty-state">{t('videos.empty')}</p>
        )}
        {!video ? (
          <label className="product-images__upload" htmlFor={videoInputId}>
            <span className="button button--primary">{t('videos.upload')}</span>
            <input
              id={videoInputId}
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              disabled={disabled}
              onChange={(event) => void replaceVideo(event.target.files)}
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}
