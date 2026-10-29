import {
  findPhoneNumbersInText,
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';

export type { CountryCode };

/** Display order only. Calling codes always come from libphonenumber-js. */
const PRIORITY_COUNTRIES: readonly CountryCode[] = [
  'GE',
  'DE',
  'FR',
  'IT',
  'ES',
  'GB',
  'PL',
  'UA',
  'US',
  'TR',
  'NL',
  'BE',
  'AT',
  'CH',
  'CZ',
  'RO',
  'BG',
  'LT',
  'LV',
  'EE',
  'PT',
  'GR',
  'IE',
  'SE',
  'NO',
  'DK',
  'FI',
  'HU',
  'SK',
  'SI',
  'HR',
  'RS',
  'AM',
  'AZ',
  'KZ',
  'AE',
  'IL',
  'IN',
  'CN',
  'JP',
  'KR',
  'AU',
  'CA',
  'BR',
  'MX',
];

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'GE';

export type CallingCountry = {
  iso: CountryCode;
  callingCode: string;
};

export function isCallingCountry(value: string | null | undefined): value is CountryCode {
  return Boolean(value && isSupportedCountry(value.toUpperCase()));
}

export function toCallingCountry(value: string | null | undefined): CountryCode | undefined {
  if (!value) return undefined;
  const iso = value.trim().toUpperCase();
  return isSupportedCountry(iso) ? iso : undefined;
}

/**
 * Parses user input into canonical E.164 (`+995…`). Returns null when the number
 * is missing, incomplete, or invalid for the selected country.
 */
export function normalizeInternationalPhone(
  raw: string,
  defaultCountry?: string | null,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const country = toCallingCountry(defaultCountry);
  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (!parsed || !parsed.isValid()) {
    return null;
  }
  return parsed.number;
}

export function parseStoredPhone(raw: string | null | undefined): {
  country: CountryCode;
  nationalNumber: string;
  e164: string;
  callingCode: string;
} | null {
  if (!raw) {
    return null;
  }
  const parsed = parsePhoneNumberFromString(raw.trim());
  if (!parsed || !parsed.isValid() || !parsed.country) {
    return null;
  }
  return {
    country: parsed.country,
    nationalNumber: parsed.nationalNumber,
    e164: parsed.number,
    callingCode: parsed.countryCallingCode,
  };
}

export function listCallingCountries(): CallingCountry[] {
  const priority = new Set<string>(PRIORITY_COUNTRIES);
  const rest = getCountries()
    .filter((iso) => !priority.has(iso))
    .sort((a, b) => a.localeCompare(b));
  const ordered = [...PRIORITY_COUNTRIES.filter((iso) => isSupportedCountry(iso)), ...rest];
  return ordered.map((iso) => ({
    iso,
    callingCode: getCountryCallingCode(iso),
  }));
}

export function callingCodeOf(country: CountryCode): string {
  return getCountryCallingCode(country);
}

/** Log-safe mask: keep country calling code and the last 2 digits. */
export function maskPhoneNumber(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.length < 6) {
    return '***';
  }
  const prefix = digits.startsWith('+') ? digits.slice(0, Math.min(5, digits.length - 2)) : digits.slice(0, 3);
  return `${prefix}***${digits.slice(-2)}`;
}

/** Character range of a phone number found in free text. `end` is exclusive. */
export type PhoneLikeSpan = {
  start: number;
  end: number;
};

/**
 * Valid phone numbers written in free text, such as a contact number pasted
 * into a listing description. Georgian numbers may omit +995; other countries
 * need their international prefix. Only numbers libphonenumber validates for a
 * real numbering plan match, so prices, quantities, dates, barcodes, standards
 * and certificate numbers are not reported.
 */
export function findPhoneLikeNumbers(text: string | null | undefined): PhoneLikeSpan[] {
  if (!text) return [];
  return findPhoneNumbersInText(text, { defaultCountry: DEFAULT_PHONE_COUNTRY }).map((match) => {
    let start = match.startsAt;
    let end = match.endsAt;
    // libphonenumber keeps a bracket that only opens or closes the number, e.g. "(599123456)".
    const matched = text.slice(start, end);
    if (matched.startsWith('(') && !matched.includes(')')) start += 1;
    if (matched.endsWith(')') && !matched.includes('(')) end -= 1;
    return { start, end };
  });
}

export function containsPhoneLikeNumber(text: string | null | undefined): boolean {
  return findPhoneLikeNumbers(text).length > 0;
}

/** Names of the fields whose text contains a phone-like number, in the given order. */
export function phoneLikeFieldNames<T extends string>(
  fields: ReadonlyArray<readonly [T, string | null | undefined]>,
): T[] {
  return fields.filter(([, value]) => containsPhoneLikeNumber(value)).map(([name]) => name);
}

