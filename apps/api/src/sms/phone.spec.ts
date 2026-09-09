import {
  maskPhoneNumber,
  normalizeInternationalPhone,
  parseStoredPhone,
} from '@agrobridge/shared';

describe('normalizeInternationalPhone', () => {
  it('normalises a Georgian E.164 number', () => {
    expect(normalizeInternationalPhone('+995555123456')).toBe('+995555123456');
  });

  it('normalises a Georgian national number when the country is GE', () => {
    expect(normalizeInternationalPhone('555 12 34 56', 'GE')).toBe('+995555123456');
    expect(normalizeInternationalPhone('0555123456', 'GE')).toBe('+995555123456');
  });

  it('normalises German, French, and Italian numbers', () => {
    expect(normalizeInternationalPhone('+49 151 23456789')).toBe('+4915123456789');
    expect(normalizeInternationalPhone('0151 23456789', 'DE')).toBe('+4915123456789');
    expect(normalizeInternationalPhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizeInternationalPhone('0612345678', 'FR')).toBe('+33612345678');
    expect(normalizeInternationalPhone('+39 347 1234567')).toBe('+393471234567');
  });

  it('rejects invalid and incomplete numbers', () => {
    expect(normalizeInternationalPhone('abc')).toBeNull();
    expect(normalizeInternationalPhone('123')).toBeNull();
    expect(normalizeInternationalPhone('555123456')).toBeNull();
    expect(normalizeInternationalPhone('+99512')).toBeNull();
  });

  it('rejects a national number for the wrong country', () => {
    expect(normalizeInternationalPhone('0612345678', 'GE')).toBeNull();
  });

  it('parses a stored E.164 value back into country + national parts', () => {
    expect(parseStoredPhone('+995555123456')).toMatchObject({
      country: 'GE',
      nationalNumber: '555123456',
      e164: '+995555123456',
      callingCode: '995',
    });
  });

  it('masks a phone number for logs', () => {
    const masked = maskPhoneNumber('+995555123456');
    expect(masked).toContain('+995');
    expect(masked).not.toContain('555123456');
    expect(masked.endsWith('56')).toBe(true);
  });
});
