'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

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
  const shown = display?.trim() || source?.trim() || '';
  const original = source?.trim() || shown;
  const text = toggle?.open ? original : shown;
  if (!text) {
    return null;
  }
  return <span className={className}>{text}</span>;
}

export function OriginalToggleButton({
  showOriginalLabel,
  showTranslationLabel,
  originalLanguageLabel,
}: {
  showOriginalLabel: string;
  showTranslationLabel: string;
  originalLanguageLabel: string;
}) {
  const toggle = useContext(ToggleContext);
  if (!toggle?.differs) {
    return null;
  }
  return (
    <div className="original-toggle">
      {toggle.open ? <p className="product-list__meta">{originalLanguageLabel}</p> : null}
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
