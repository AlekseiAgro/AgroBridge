'use client';

import { PRODUCT_VIDEO_MAX_COUNT, type ProductDetail, type ProductVideo } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toPublicMediaUrl } from '@/lib/product-image';

type Props = {
  productId: string;
  initialVideos: ProductVideo[];
};

export function ProductVideosManager({ productId, initialVideos }: Props) {
  const t = useTranslations('product');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState(initialVideos);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refreshFrom(product: ProductDetail) {
    setVideos(product.videos);
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
      const response = await fetch(`/api/products/${productId}/videos`, {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('videos.uploadError'));
        return;
      }
      refreshFrom(data);
    } catch {
      setError(t('videos.uploadError'));
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onDelete(videoId: string) {
    if (!window.confirm(t('videos.deleteConfirm'))) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/videos/${videoId}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('videos.deleteError'));
        return;
      }
      refreshFrom(data);
    } catch {
      setError(t('videos.deleteError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="product-images product-videos">
      <div className="product-images__header">
        <h2 className="section-title">{t('videos.title')}</h2>
        <p className="page__subtitle">{t('videos.subtitle', { max: PRODUCT_VIDEO_MAX_COUNT })}</p>
      </div>
      {videos.length ? (
        <ul className="product-images__grid">
          {videos.map((video) => (
            <li key={video.id} className="product-images__item">
              <video className="product-images__thumb" controls preload="metadata">
                <source src={toPublicMediaUrl(video.url)} type={video.mimeType} />
              </video>
              <span className="product-list__meta">{video.fileName}</span>
              <button
                type="button"
                className="button button--ghost"
                disabled={pending}
                onClick={() => void onDelete(video.id)}
              >
                {t('videos.delete')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{t('videos.empty')}</p>
      )}
      {videos.length < PRODUCT_VIDEO_MAX_COUNT ? (
        <label className="product-images__upload">
          <span className="button button--primary">
            {pending ? t('pleaseWait') : t('videos.upload')}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            disabled={pending}
            onChange={(event) => void onUpload(event.target.files)}
          />
        </label>
      ) : (
        <p className="product-list__meta">
          {t('videos.maxReached', { max: PRODUCT_VIDEO_MAX_COUNT })}
        </p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
