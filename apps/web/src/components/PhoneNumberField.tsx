'use client';

import {
  callingCodeOf,
  DEFAULT_PHONE_COUNTRY,
  listCallingCountries,
  parseStoredPhone,
  type CountryCode,
} from '@agrobridge/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

export { DEFAULT_PHONE_COUNTRY, parseStoredPhone };

type Props = {
  country: CountryCode;
  national: string;
  disabled?: boolean;
  onChange: (next: { country: CountryCode; national: string }) => void;
};

function countryLabel(iso: CountryCode, locale: string, names: Intl.DisplayNames): string {
  const name = names.of(iso) ?? iso;
  return `${name} (+${callingCodeOf(iso)})`;
}

export function PhoneNumberField({ country, national, disabled, onChange }: Props) {
  const t = useTranslations('farm.verification.phone');
  const locale = useLocale();
  const names = useMemo(
    () => new Intl.DisplayNames([locale], { type: 'region' }),
    [locale],
  );
  const countries = useMemo(() => {
    const priority = new Set(['GE', 'DE', 'FR', 'IT', 'ES', 'GB', 'PL', 'UA', 'US']);
    return [...listCallingCountries()].sort((a, b) => {
      const aPri = priority.has(a.iso) ? 0 : 1;
      const bPri = priority.has(b.iso) ? 0 : 1;
      if (aPri !== bPri) {
        return aPri - bPri;
      }
      return countryLabel(a.iso, locale, names).localeCompare(
        countryLabel(b.iso, locale, names),
        locale,
      );
    });
  }, [locale, names]);

  const callingCode = `+${callingCodeOf(country)}`;

  return (
    <div className="verification-phone">
      <label className="field">
        <span>{t('country')}</span>
        <select
          value={country}
          disabled={disabled}
          aria-label={t('country')}
          onChange={(event) =>
            onChange({ country: (event.target.value as CountryCode) || DEFAULT_PHONE_COUNTRY, national })
          }
        >
          {countries.map((item) => (
            <option key={item.iso} value={item.iso}>
              {countryLabel(item.iso, locale, names)}
            </option>
          ))}
        </select>
      </label>
      <label className="field verification-phone__number">
        <span>{t('number')}</span>
        <div className="verification-phone__input">
          <span className="verification-phone__code">{callingCode}</span>
          <input
            value={national}
            onChange={(event) => onChange({ country, national: event.target.value })}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={t('placeholder')}
            disabled={disabled}
            required
            aria-label={t('number')}
          />
        </div>
        <p className="field-hint">{t('hint', { code: callingCode })}</p>
      </label>
    </div>
  );
}
