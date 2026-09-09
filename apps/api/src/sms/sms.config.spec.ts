import { resolveSmsConfig, sanitizeSmsError } from './sms.config';

function reader(env: Record<string, string>) {
  return { get: (key: string) => env[key] };
}

const INFOBIP = {
  SMS_DRIVER: 'infobip',
  INFOBIP_API_KEY: 'test-infobip-key-value',
  INFOBIP_BASE_URL: 'https://abcd12.api.infobip.com',
  INFOBIP_SENDER: 'InfoSMS',
};

describe('resolveSmsConfig', () => {
  it('allows console without Infobip variables', () => {
    expect(resolveSmsConfig(reader({})).driver).toBe('console');
  });

  it('rejects console when NODE_ENV=production', () => {
    expect(() =>
      resolveSmsConfig(reader({ NODE_ENV: 'production', SMS_DRIVER: 'console' })),
    ).toThrow(/not allowed when NODE_ENV=production/);
  });

  it('allows console in production only with an explicit staging override', () => {
    expect(
      resolveSmsConfig(
        reader({ NODE_ENV: 'production', SMS_DRIVER: 'console', SMS_ALLOW_CONSOLE: 'true' }),
      ).driver,
    ).toBe('console');
  });

  it('requires Infobip secrets when SMS_DRIVER=infobip', () => {
    expect(() => resolveSmsConfig(reader({ SMS_DRIVER: 'infobip' }))).toThrow(
      /INFOBIP_API_KEY/,
    );
    expect(() =>
      resolveSmsConfig(reader({ SMS_DRIVER: 'infobip', INFOBIP_API_KEY: 'test-infobip-key-value' })),
    ).toThrow(/INFOBIP_BASE_URL/);
  });

  it('does not mention the API key in missing-config errors', () => {
    try {
      resolveSmsConfig(
        reader({
          SMS_DRIVER: 'infobip',
          INFOBIP_API_KEY: 'test-infobip-key-value',
          INFOBIP_BASE_URL: 'https://abcd12.api.infobip.com',
        }),
      );
      throw new Error('expected throw');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('test-infobip-key-value');
      expect(message).toContain('INFOBIP_SENDER');
    }
  });

  it('accepts a valid Infobip HTTPS base URL', () => {
    const settings = resolveSmsConfig(reader(INFOBIP));
    expect(settings).toMatchObject({
      driver: 'infobip',
      baseUrl: 'https://abcd12.api.infobip.com',
      sender: 'InfoSMS',
    });
  });

  it('rejects non-HTTPS and non-Infobip hosts (SSRF)', () => {
    expect(() =>
      resolveSmsConfig(reader({ ...INFOBIP, INFOBIP_BASE_URL: 'http://abcd12.api.infobip.com' })),
    ).toThrow(/HTTPS/);
    expect(() =>
      resolveSmsConfig(reader({ ...INFOBIP, INFOBIP_BASE_URL: 'https://127.0.0.1' })),
    ).toThrow(/api\.infobip\.com/);
    expect(() =>
      resolveSmsConfig(
        reader({ ...INFOBIP, INFOBIP_BASE_URL: 'https://abcd12.api.infobip.com/sms' }),
      ),
    ).toThrow(/path/);
  });

  it('rejects unknown drivers', () => {
    expect(() => resolveSmsConfig(reader({ SMS_DRIVER: 'vonage' }))).toThrow(
      /console or infobip/,
    );
  });

  it('redacts API keys in sanitised error text', () => {
    expect(
      sanitizeSmsError('Authorization: App test-infobip-key-value failed', [
        'test-infobip-key-value',
      ]),
    ).not.toContain('test-infobip-key-value');
  });
});
