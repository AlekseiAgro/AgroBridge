'use client';

import type { LegalLocale } from '@agrobridge/shared';

type Props = {
  value: LegalLocale;
  onChange: (locale: LegalLocale) => void;
};

const OPTIONS: Array<{ locale: LegalLocale; label: string }> = [
  { locale: 'ka', label: 'ქართული' },
  { locale: 'en', label: 'English' },
];

export function LegalLanguageSwitch({ value, onChange }: Props) {
  return (
    <div className="legal-lang-switch" role="group" aria-label="ქართული | English">
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          aria-pressed={value === option.locale}
          onClick={() => onChange(option.locale)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
