'use client';

import { legalLocaleFor, type LegalLocale } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { legalDocumentView, type LegalDocumentKind } from '@/content/legal';
import { LegalDocumentArticle } from '@/components/LegalDocumentArticle';
import { LegalLanguageSwitch } from '@/components/LegalLanguageSwitch';

type Props = {
  open: boolean;
  kind: Extract<LegalDocumentKind, 'terms' | 'privacy'> | null;
  uiLocale: string;
  onClose: () => void;
};

export function LegalDocumentDialog({ open, kind, uiLocale, onClose }: Props) {
  const t = useTranslations('legal');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [legalLocale, setLegalLocale] = useState<LegalLocale>(legalLocaleFor(uiLocale));
  const document = kind ? legalDocumentView(kind, legalLocale) : null;

  useEffect(() => {
    if (open) {
      setLegalLocale(legalLocaleFor(uiLocale));
    }
  }, [open, uiLocale, kind]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onClick(event: MouseEvent) {
      if (event.target === dialogRef.current) {
        onClose();
      }
    }

    dialog.addEventListener('click', onClick);
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('close', onClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="legal-document-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
    >
      {document ? (
        <div className="legal-document-dialog__card">
          <div className="legal-document-dialog__head">
            <LegalLanguageSwitch value={legalLocale} onChange={setLegalLocale} />
            <button type="button" className="button button--ghost" onClick={onClose}>
              {t('close')}
            </button>
          </div>
          <div className="legal-document-dialog__scroll">
            <LegalDocumentArticle document={document} headingLevel="h2" headingId={titleId} />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
