'use client';

import {
  CERTIFICATE_TYPES,
  type CertificateType,
  type ProductCertificate,
  type ProductDetail,
} from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toPublicMediaUrl } from '@/lib/product-image';

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
  const [type, setType] = useState<CertificateType>('globalGap');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refreshFrom(product: ProductDetail) {
    setCertificates(product.certificates);
    router.refresh();
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t('certificates.fileRequired'));
      return;
    }
    setPending(true);
    setError(null);
    const body = new FormData();
    body.append('type', type);
    body.append('title', title);
    body.append('file', file);

    try {
      const response = await fetch(`/api/products/${productId}/certificates`, {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as ProductDetail & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('certificates.uploadError'));
        return;
      }
      refreshFrom(data);
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setError(t('certificates.uploadError'));
    } finally {
      setPending(false);
    }
  }

  async function onDelete(certificateId: string) {
    if (!window.confirm(t('certificates.deleteConfirm'))) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${productId}/certificates/${certificateId}`, {
        method: 'DELETE',
      });
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

  return (
    <section className="product-images product-certificates">
      <div className="product-images__header">
        <h2 className="section-title">{t('certificates.title')}</h2>
        <p className="page__subtitle">{t('certificates.subtitle')}</p>
      </div>
      {certificates.length ? (
        <ul className="admin-doc-list">
          {certificates.map((certificate) => (
            <li key={certificate.id} className="product-certificate">
              <div>
                <a href={toPublicMediaUrl(certificate.url)} target="_blank" rel="noreferrer">
                  {certificate.title}
                </a>
                <p className="product-list__meta">
                  {tq(`certificates.${certificate.type}`)} ·{' '}
                  {t(`certificates.status.${certificate.reviewStatus}`)}
                </p>
              </div>
              <button
                type="button"
                className="button button--ghost"
                disabled={pending}
                onClick={() => void onDelete(certificate.id)}
              >
                {t('certificates.delete')}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{t('certificates.empty')}</p>
      )}
      <form className="product-media-upload" onSubmit={onUpload}>
        <label className="field">
          <span>{t('certificates.type')}</span>
          <select value={type} onChange={(event) => setType(event.target.value as CertificateType)}>
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
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('certificates.titlePlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('certificates.file')}</span>
          <input
            ref={fileRef}
            required
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
          />
        </label>
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? t('pleaseWait') : t('certificates.upload')}
        </button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
