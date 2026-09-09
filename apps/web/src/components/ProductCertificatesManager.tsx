'use client';

import {
  CERTIFICATE_TYPES,
  FARM_DOCUMENT_MAX_COUNT,
  type CertificateType,
  type ProductCertificate,
  type ProductDetail,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import {
  isAuthorizedCertificateHref,
  ownerCertificateFileHref,
} from '@/lib/product-certificate-ui';

type Props = {
  productId: string;
  initialCertificates: ProductCertificate[];
};

export function ProductCertificatesManager({ productId, initialCertificates }: Props) {
  const t = useTranslations('product');
  const tq = useTranslations('quality');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [certificates, setCertificates] = useState(initialCertificates);
  const [type, setType] = useState<CertificateType>('organic');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refreshFrom(product: ProductDetail) {
    setCertificates(product.certificates);
    router.refresh();
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('certificates.titleRequired'));
      return;
    }

    setPending(true);
    setError(null);
    const body = new FormData();
    body.set('type', type);
    body.set('title', trimmedTitle);
    body.set('file', file);

    try {
      const response = await fetch(`/api/products/${productId}/certificates`, {
        method: 'POST',
        body,
        cache: 'no-store',
      });
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('certificates.uploadError'));
        return;
      }
      refreshFrom(data);
      setTitle('');
    } catch {
      setError(t('certificates.uploadError'));
    } finally {
      setPending(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  }

  async function onDelete(certificateId: string) {
    if (!window.confirm(t('certificates.deleteConfirm'))) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/products/${productId}/certificates/${certificateId}`,
        { method: 'DELETE', cache: 'no-store' },
      );
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('certificates.deleteError'));
        return;
      }
      refreshFrom(data);
    } catch {
      setError(t('certificates.deleteError'));
    } finally {
      setPending(false);
    }
  }

  const canUpload = certificates.length < FARM_DOCUMENT_MAX_COUNT;

  return (
    <section className="product-images product-form__section">
      <div className="product-images__header">
        <h2 className="section-title">{t('certificates.title')}</h2>
        <p className="page__subtitle">
          {t('certificates.subtitle', { max: FARM_DOCUMENT_MAX_COUNT })}
        </p>
      </div>

      {certificates.length === 0 ? (
        <p className="empty-state">{t('certificates.empty')}</p>
      ) : (
        <ul className="product-list">
          {certificates.map((cert) => {
            const href = ownerCertificateFileHref(productId, cert.id);
            return (
              <li key={cert.id} className="product-list__item">
                <p className="product-list__title">{cert.title}</p>
                <p className="product-list__meta">
                  {tq(`certificates.${cert.type}`)} · {cert.fileName} ·{' '}
                  {t(`certificates.status.${cert.reviewStatus}`)}
                </p>
                {cert.reviewNote ? (
                  <p className="form-error">
                    {t('certificates.note')}: {cert.reviewNote}
                  </p>
                ) : null}
                <div className="product-list__actions">
                  {isAuthorizedCertificateHref(href) ? (
                    <a
                      className="button button--ghost"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('certificates.open')}
                    </a>
                  ) : null}
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={pending}
                    onClick={() => void onDelete(cert.id)}
                  >
                    {t('certificates.delete')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canUpload ? (
        <div className="moderation-actions" style={{ marginTop: '1rem' }}>
          <label className="field">
            <span>{t('certificates.type')}</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as CertificateType)}
              disabled={pending}
            >
              {CERTIFICATE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {tq(`certificates.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('certificates.titleField')}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('certificates.titlePlaceholder')}
              disabled={pending}
            />
          </label>
          <label className={pending ? 'verification-upload is-pending' : 'verification-upload'}>
            <span className="button button--primary" aria-hidden="true">
              {pending ? t('pleaseWait') : t('certificates.upload')}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              disabled={pending}
              aria-label={t('certificates.upload')}
              onChange={(event) => void onUpload(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : (
        <p className="product-list__meta">
          {t('certificates.maxReached', { max: FARM_DOCUMENT_MAX_COUNT })}
        </p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
