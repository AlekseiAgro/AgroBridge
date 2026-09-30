'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

import { translationCopyDiffers, visibleTranslationText } from '@/lib/product-translation';

type ToggleContextValue = {
  open: boolean;
  differs: boolean;
  setOpen: (open: boolean) => void;
};

const ToggleContext = createContext<ToggleContextValue | null>(null);

export function OriginalToggleFrame({
  differs,
  children,
}: {
  differs: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ToggleContext.Provider value={{ open, differs, setOpen }}>{children}</ToggleContext.Provider>
  );
}

export function OriginalText({
  display,
  source,
  className,
}: {
  display?: string | null;
  source?: string | null;
  className?: string;
}) {
  const toggle = useContext(ToggleContext);
  const text = visibleTranslationText(Boolean(toggle?.open), display, source);
  if (!text) {
    return null;
  }
  return <span className={className}>{text}</span>;
}

/** Non-clickable caption for one rendered field whose display text differs from source. */
export function TranslationMark({
  display,
  source,
  translatedLabel,
  originalLabel,
}: {
  display?: string | null;
  source?: string | null;
  translatedLabel: string;
  originalLabel: string;
}) {
  const toggle = useContext(ToggleContext);
  if (!translationCopyDiffers(display, source)) {
    return null;
  }
  return <span className="translation-mark">{toggle?.open ? originalLabel : translatedLabel}</span>;
}

export function OriginalToggleButton({
  showOriginalLabel,
  showTranslationLabel,
  originalLanguageLabel,
  presentation = 'split',
}: {
  showOriginalLabel: string;
  showTranslationLabel: string;
  originalLanguageLabel: string;
  /** Product detail uses one combined control. Other pages keep the language caption separate. */
  presentation?: 'split' | 'single';
}) {
  const toggle = useContext(ToggleContext);
  if (!toggle?.differs) {
    return null;
  }
  return (
    <div className="original-toggle">
      {presentation === 'split' && toggle.open ? (
        <p className="product-list__meta">{originalLanguageLabel}</p>
      ) : null}
      <button
        type="button"
        className="text-button"
        onClick={() => toggle.setOpen(!toggle.open)}
      >
        {toggle.open ? showTranslationLabel : showOriginalLabel}
      </button>
    </div>
  );
}

/** Compact control for a catalog card. Reveals the original title only after a click. */
export function CardOriginalTitle({
  original,
  showOriginalLabel,
  showTranslationLabel,
}: {
  original: string | null;
  showOriginalLabel: string;
  showTranslationLabel: string;
}) {
  const [open, setOpen] = useState(false);
  if (!original) {
    return null;
  }
  return (
    <p className="product-list__meta original-toggle">
      <button type="button" className="text-button" onClick={() => setOpen((value) => !value)}>
        {open ? showTranslationLabel : showOriginalLabel}
      </button>
      {open ? <span>{original}</span> : null}
    </p>
  );
}
