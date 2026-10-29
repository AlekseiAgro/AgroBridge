'use client';

import type { LegalLocale } from '@agrobridge/shared';
import { useTranslations } from 'next-intl';
import { useId } from 'react';

type Props = {
  value: LegalLocale;
  onChange: (locale: LegalLocale) => void;
};

const OPTIONS: Array<{ locale: LegalLocale; label: string }> = [
  { locale: 'ka', label: 'ქართული' },
  { locale: 'en', label: 'English' },
];

export function LegalLanguageSwitch({ value, onChange }: Props) {
  const t = useTranslations('legal');
  const labelId = useId();

  return (
    <div className="legal-lang-field">
      <span id={labelId} className="legal-lang-field__label">
        {t('documentLanguage')}
      </span>
      <div className="legal-lang-switch" role="group" aria-labelledby={labelId}>
        {OPTIONS.map((option) => (
          <button
            key={option.locale}
            type="button"
            lang={option.locale}
            aria-pressed={value === option.locale}
            onClick={() => onChange(option.locale)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
