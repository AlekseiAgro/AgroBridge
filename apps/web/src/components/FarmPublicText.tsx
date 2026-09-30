'use client';

import type { FarmDisplayText, FarmSourceText } from '@agrobridge/shared';
import { useState } from 'react';

type Labels = {
  producerType: string;
  exportMarkets: string;
  registeredName: string;
  showOriginal: string;
  showTranslation: string;
  originalLanguage: string;
};

type Props = {
  source?: FarmSourceText | null;
  display?: FarmDisplayText | null;
  companyRegistryName?: string | null;
  producerTypeLabel?: string | null;
  legacyOwnership?: string | null;
  labels: Labels;
};

function same(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? '').trim() === (right ?? '').trim();
}

export function FarmPublicText({
  source,
  display,
  companyRegistryName,
  producerTypeLabel,
  legacyOwnership,
  labels,
}: Props) {
  const translated = display ?? source ?? null;
  const original = source ?? translated;
  const differs = Boolean(
    original &&
      translated &&
      (!same(translated.description, original.description) ||
        !same(translated.history, original.history) ||
        translated.exportMarkets.join('\n') !== original.exportMarkets.join('\n')),
  );
  const producerValue = producerTypeLabel || legacyOwnership || null;
  const [open, setOpen] = useState(false);
  const text = open && original ? original : translated;
  if (!text && !companyRegistryName) {
    return null;
  }

  return (
    <div className="farm-public-text">
      {text?.description ? <p className="detail-text farm-profile__lede">{text.description}</p> : null}
      {companyRegistryName ? (
        <p className="product-list__meta">
          {labels.registeredName}: {companyRegistryName}
        </p>
      ) : null}
      {producerValue ? (
        <p className="detail-text">
          <span className="farm-public-text__label">{labels.producerType}</span>
          {producerValue}
        </p>
      ) : null}
      {text && text.exportMarkets.length > 0 ? (
        <p className="detail-text">
          <span className="farm-public-text__label">{labels.exportMarkets}</span>
          {text.exportMarkets.join(', ')}
        </p>
      ) : null}
      {text?.history ? <p className="detail-text">{text.history}</p> : null}
      {differs ? (
        <div className="original-toggle">
          {open ? <p className="product-list__meta">{labels.originalLanguage}</p> : null}
          <button type="button" className="text-button" onClick={() => setOpen((value) => !value)}>
            {open ? labels.showTranslation : labels.showOriginal}
          </button>
        </div>
      ) : null}
    </div>
  );
}
