'use client';

import { useTranslations } from 'next-intl';
import type { LegalDocumentView } from '@/content/legal';

type Props = {
  document: LegalDocumentView;
  headingLevel?: 'h1' | 'h2';
  headingId?: string;
};

export function LegalDocumentArticle({ document, headingLevel = 'h1', headingId }: Props) {
  const t = useTranslations('legal');
  const Heading = headingLevel;

  return (
    <article className="legal-document">
      <header className="legal-document__header">
        <Heading id={headingId} className="legal-document__title">
          {document.title}
        </Heading>
        {document.version ? (
          <p className="legal-document__version">{t('version', { version: document.version })}</p>
        ) : null}
      </header>
      <div className="legal-document__body">
        {document.pending ? (
          <p className="legal-document__pending">{t('documentPending')}</p>
        ) : (
          document.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
        )}
      </div>
    </article>
  );
}
