'use client';

import type { FarmDocument, FarmDocumentKind } from '@agrobridge/shared';
import { FARM_DOCUMENT_KINDS, FARM_DOCUMENT_MAX_COUNT } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { toPublicMediaUrl } from '@/lib/product-image';

type Props = {
  initialDocuments: FarmDocument[];
};

export function FarmDocumentsManager({ initialDocuments }: Props) {
  const t = useTranslations('farm');
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<FarmDocumentKind>('other');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(file: File | null) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('title', title.trim() || file.name);
      body.set('kind', kind);
      body.set('file', file);
      const response = await fetch('/api/farms/me/documents', {
        method: 'POST',
        body,
      });
      const data = (await response.json()) as FarmDocument & { message?: string };
      if (!response.ok) {
        setError(data.message ?? t('documents.uploadError'));
        return;
      }
      setDocuments((prev) => [data, ...prev]);
      setTitle('');
      router.refresh();
    } catch {
      setError(t('documents.uploadError'));
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t('documents.deleteConfirm'))) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/farms/me/documents/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        setError(data.message ?? t('documents.deleteError'));
        return;
      }
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      router.refresh();
    } catch {
      setError(t('documents.deleteError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="product-images" style={{ marginTop: '2rem' }}>
      <div className="product-images__header">
        <h2 className="section-title">{t('documents.title')}</h2>
        <p className="page__subtitle">
          {t('documents.subtitle', { max: FARM_DOCUMENT_MAX_COUNT })}
        </p>
      </div>

      {documents.length === 0 ? (
        <p className="empty-state">{t('documents.empty')}</p>
      ) : (
        <ul className="product-list">
          {documents.map((doc) => (
            <li key={doc.id} className="product-list__item">
              <p className="product-list__title">{doc.title}</p>
              <p className="product-list__meta">
                {t(`documents.kinds.${doc.kind}`)} · {doc.fileName} ·{' '}
                {t(`documents.status.${doc.reviewStatus}`)}
              </p>
              {doc.reviewNote ? (
                <p className="form-error">
                  {t('documents.note')}: {doc.reviewNote}
                </p>
              ) : null}
              <div className="product-list__actions">
                <a
                  className="button button--ghost"
                  href={toPublicMediaUrl(doc.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('documents.open')}
                </a>
                <button
                  className="button button--ghost"
                  type="button"
                  disabled={pending}
                  onClick={() => onDelete(doc.id)}
                >
                  {t('documents.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {documents.length < FARM_DOCUMENT_MAX_COUNT ? (
        <div className="moderation-actions" style={{ marginTop: '1rem' }}>
          <label className="field">
            <span>{t('documents.titleField')}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('documents.titlePlaceholder')}
            />
          </label>
          <label className="field">
            <span>{t('documents.kindField')}</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as FarmDocumentKind)}
            >
              {FARM_DOCUMENT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`documents.kinds.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="product-images__upload">
            <span>{pending ? t('pleaseWait') : t('documents.upload')}</span>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
