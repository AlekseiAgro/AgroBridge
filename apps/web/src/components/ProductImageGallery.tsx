'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type GalleryImage = {
  id: string;
  url: string;
};

type Props = {
  images: GalleryImage[];
  productName: string;
};

export function ProductImageGallery({ images, productName }: Props) {
  const t = useTranslations('product');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pointerStart = useRef<number | null>(null);
  const pointerMoved = useRef(false);
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const count = images.length;
  const safeIndex = count === 0 ? 0 : ((index % count) + count) % count;
  const current = images[safeIndex];

  const countRef = useRef(count);
  useEffect(() => {
    countRef.current = count;
  });

  function step(delta: number) {
    if (count < 2) {
      return;
    }
    setIndex((value) => (value + delta + count) % count);
  }

  function openViewer() {
    setViewerOpen(true);
    dialogRef.current?.showModal();
  }

  function closeViewer() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const viewer = dialog;
    function onClose() {
      setViewerOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (!viewer.open) {
        return;
      }
      const total = countRef.current;
      if (total < 2) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((value) => (value + 1) % total);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((value) => (value - 1 + total) % total);
      }
    }
    viewer.addEventListener('close', onClose);
    window.addEventListener('keydown', onKey);
    return () => {
      viewer.removeEventListener('close', onClose);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    pointerStart.current = event.clientX;
    pointerMoved.current = false;
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (pointerStart.current == null) {
      return;
    }
    if (Math.abs(event.clientX - pointerStart.current) > 12) {
      pointerMoved.current = true;
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (pointerStart.current == null) {
      return;
    }
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (delta <= -48) {
      step(1);
      return;
    }
    if (delta >= 48) {
      step(-1);
      return;
    }
    if (!pointerMoved.current) {
      openViewer();
    }
  }

  if (!current) {
    return null;
  }

  const counter = t('galleryCounter', { current: safeIndex + 1, total: count });

  return (
    <div className="product-gallery-stage">
      <button
        type="button"
        className="product-gallery-stage__open"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
        aria-label={t('galleryOpen', { current: safeIndex + 1, total: count })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={productName} className="product-gallery-stage__image" />
        <span className="product-gallery-stage__counter">{counter}</span>
      </button>
      {count > 1 ? (
        <div className="product-gallery-thumbs" role="tablist" aria-label={productName}>
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              type="button"
              role="tab"
              className={
                imageIndex === safeIndex
                  ? 'product-gallery-thumbs__button product-gallery-thumbs__button--active'
                  : 'product-gallery-thumbs__button'
              }
              aria-selected={imageIndex === safeIndex}
              onClick={() => setIndex(imageIndex)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="product-gallery-thumbs__image" />
            </button>
          ))}
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className="product-photo-viewer"
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeViewer();
          }
        }}
      >
        <div className="product-photo-viewer__bar">
          <p id={titleId} className="product-photo-viewer__counter">
            {counter}
          </p>
          <button type="button" className="button button--ghost" onClick={closeViewer}>
            {t('galleryClose')}
          </button>
        </div>
        {viewerOpen ? (
          <div className="product-photo-viewer__stage">
            {count > 1 ? (
              <button type="button" className="product-photo-viewer__nav" onClick={() => step(-1)}>
                {t('galleryPrevious')}
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={productName}
              className="product-photo-viewer__image"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => {
                if (pointerStart.current == null) {
                  return;
                }
                const delta = event.clientX - pointerStart.current;
                pointerStart.current = null;
                if (delta <= -48) {
                  step(1);
                } else if (delta >= 48) {
                  step(-1);
                }
              }}
            />
            {count > 1 ? (
              <button type="button" className="product-photo-viewer__nav" onClick={() => step(1)}>
                {t('galleryNext')}
              </button>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
