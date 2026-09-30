'use client';

import type { FarmDisplayText, FarmSourceText } from '@agrobridge/shared';
import { useState } from 'react';

type Labels = {
  producerType: string;
  exportMarkets: string;
  registeredName: string;
  translatedAutomatically: string;
  showingOriginal: string;
  translatedMark: string;
  originalMark: string;
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
  const descriptionDiffers = Boolean(
    original && translated && !same(translated.description, original.description),
  );
  const historyDiffers = Boolean(original && translated && !same(translated.history, original.history));
  const marketsDiffer = Boolean(
    original && translated && translated.exportMarkets.join('\n') !== original.exportMarkets.join('\n'),
  );
  const differs = descriptionDiffers || historyDiffers || marketsDiffer;
  const producerValue = producerTypeLabel || legacyOwnership || null;
  const [open, setOpen] = useState(false);
  const text = open && original ? original : translated;
  if (!text && !companyRegistryName) {
    return null;
  }

  const mark = open ? labels.originalMark : labels.translatedMark;

  return (
    <div className="farm-public-text">
      {differs ? (
        <div className="original-toggle">
          <button type="button" className="text-button" onClick={() => setOpen((value) => !value)}>
            {open ? labels.showingOriginal : labels.translatedAutomatically}
          </button>
        </div>
      ) : null}
      {text?.description ? (
        <p className="detail-text farm-profile__lede">
          {text.description}
          {descriptionDiffers ? <span className="translation-mark">{mark}</span> : null}
        </p>
      ) : null}
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
          {marketsDiffer ? <span className="translation-mark">{mark}</span> : null}
        </p>
      ) : null}
      {text?.history ? (
        <p className="detail-text">
          {text.history}
          {historyDiffers ? <span className="translation-mark">{mark}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
