'use client';

import { legalLocaleFor, type LegalLocale } from '@agrobridge/shared';
import { useState } from 'react';
import { legalDocumentView, type LegalDocumentKind } from '@/content/legal';
import { LegalDocumentArticle } from '@/components/LegalDocumentArticle';
import { LegalLanguageSwitch } from '@/components/LegalLanguageSwitch';

type Props = {
  uiLocale: string;
  kind: LegalDocumentKind;
};

export function LegalDocumentPanel({ uiLocale, kind }: Props) {
  const [legalLocale, setLegalLocale] = useState<LegalLocale>(legalLocaleFor(uiLocale));
  const document = legalDocumentView(kind, legalLocale);

  return (
    <div className="legal-page__sheet">
      <div className="legal-page__toolbar">
        <LegalLanguageSwitch value={legalLocale} onChange={setLegalLocale} />
      </div>
      <LegalDocumentArticle document={document} />
    </div>
  );
}
