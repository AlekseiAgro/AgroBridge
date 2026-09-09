import {
  describeMailConfig,
  isTransientSmtpError,
  resolveMailConfig,
  sanitizeMailError,
} from './mail.config';

const SMTP = {
  MAIL_DRIVER: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 's3cret-token-value',
  MAIL_FROM: 'AgroBridge <noreply@agrobridge.ge>',
};

const RESEND = {
  MAIL_DRIVER: 'resend',
  RESEND_API_KEY: 're_test_secret_key_value',
  MAIL_FROM: 'AgroBridge <no-reply@agrobridge.ge>',
};

function reader(env: Record<string, string>) {
  return { get: (key: string) => env[key] };
}

describe('resolveMailConfig', () => {
  it('allows console without SMTP variables', () => {
    expect(resolveMailConfig(reader({}))).toMatchObject({
      driver: 'console',
      from: 'AgroBridge <noreply@agrobridge.local>',
    });
  });

  it('allows console when NODE_ENV is not production', () => {
    expect(
      resolveMailConfig(reader({ NODE_ENV: 'development', MAIL_DRIVER: 'console' })).driver,
    ).toBe('console');
    expect(resolveMailConfig(reader({ NODE_ENV: 'test', MAIL_DRIVER: 'console' })).driver).toBe(
      'console',
    );
  });

  it('rejects console when NODE_ENV=production', () => {
    expect(() =>
      resolveMailConfig(reader({ NODE_ENV: 'production', MAIL_DRIVER: 'console' })),
    ).toThrow(/not allowed when NODE_ENV=production/);
  });

  it('allows console in production only with an explicit staging override', () => {
    expect(
      resolveMailConfig(
        reader({ NODE_ENV: 'production', MAIL_DRIVER: 'console', MAIL_ALLOW_CONSOLE: 'true' }),
      ).driver,
    ).toBe('console');
  });

  it('does not mention SMTP credentials in the production-console error', () => {
    try {
      resolveMailConfig(
        reader({
          NODE_ENV: 'production',
          MAIL_DRIVER: 'console',
          SMTP_PASSWORD: 's3cret-token-value',
        }),
      );
      throw new Error('expected resolveMailConfig to throw');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('s3cret-token-value');
      expect(message).not.toContain('SMTP_PASSWORD');
    }
  });

  it('fails when smtp is selected without SMTP_HOST', () => {
    expect(() =>
      resolveMailConfig(reader({ ...SMTP, SMTP_HOST: '' })),
    ).toThrow(/SMTP_HOST/);
  });

  it('fails when smtp is selected without SMTP_PORT', () => {
    const { SMTP_PORT: _port, ...rest } = SMTP;
    expect(() => resolveMailConfig(reader(rest))).toThrow(/SMTP_PORT/);
  });

  it('fails when smtp is selected without SMTP_USER', () => {
    const { SMTP_USER: _user, ...rest } = SMTP;
    expect(() => resolveMailConfig(reader(rest))).toThrow(/SMTP_USER and SMTP_PASSWORD/);
  });

  it('fails when smtp is selected without credentials', () => {
    const { SMTP_PASSWORD: _password, ...rest } = SMTP;
    expect(() => resolveMailConfig(reader(rest))).toThrow(/SMTP_USER and SMTP_PASSWORD/);
  });

  it('fails when smtp is selected without MAIL_FROM', () => {
    const { MAIL_FROM: _from, ...rest } = SMTP;
    expect(() => resolveMailConfig(reader(rest))).toThrow(/MAIL_FROM/);
  });

  it('accepts a complete smtp configuration', () => {
    expect(resolveMailConfig(reader(SMTP))).toEqual({
      driver: 'smtp',
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'mailer',
      password: 's3cret-token-value',
      from: 'AgroBridge <noreply@agrobridge.ge>',
      redactBodies: false,
    });
  });

  it('accepts smtp when NODE_ENV=production', () => {
    expect(
      resolveMailConfig(reader({ ...SMTP, NODE_ENV: 'production' })),
    ).toMatchObject({ driver: 'smtp', redactBodies: true });
  });

  it('defaults secure=true on port 465', () => {
    const settings = resolveMailConfig(reader({ ...SMTP, SMTP_PORT: '465' }));
    expect(settings.driver === 'smtp' && settings.secure).toBe(true);
  });

  it('rejects a URL-shaped SMTP_HOST', () => {
    expect(() =>
      resolveMailConfig(reader({ ...SMTP, SMTP_HOST: 'smtp://mailer:s3cret-token-value@smtp.example.com' })),
    ).toThrow(/hostname/);
  });

  it('rejects an unknown MAIL_DRIVER instead of falling back to console', () => {
    expect(() => resolveMailConfig(reader({ MAIL_DRIVER: 'ses' }))).toThrow(
      /console, smtp, or resend/,
    );
  });

  it('fails production resend without RESEND_API_KEY instead of falling back to console', () => {
    expect(() =>
      resolveMailConfig(
        reader({
          NODE_ENV: 'production',
          MAIL_DRIVER: 'resend',
          MAIL_FROM: RESEND.MAIL_FROM,
        }),
      ),
    ).toThrow(/RESEND_API_KEY/);
  });

  it('fails resend when RESEND_API_KEY is whitespace', () => {
    expect(() =>
      resolveMailConfig(reader({ ...RESEND, RESEND_API_KEY: '   ' })),
    ).toThrow(/RESEND_API_KEY/);
  });

  it('fails resend without MAIL_FROM', () => {
    const { MAIL_FROM: _from, ...rest } = RESEND;
    expect(() => resolveMailConfig(reader(rest))).toThrow(/MAIL_FROM/);
  });

  it('fails resend when MAIL_FROM is whitespace', () => {
    expect(() => resolveMailConfig(reader({ ...RESEND, MAIL_FROM: ' \t ' }))).toThrow(/MAIL_FROM/);
  });

  it('accepts a complete resend configuration without SMTP variables', () => {
    expect(resolveMailConfig(reader({ ...RESEND, NODE_ENV: 'production' }))).toEqual({
      driver: 'resend',
      from: 'AgroBridge <no-reply@agrobridge.ge>',
      redactBodies: true,
      apiKey: 're_test_secret_key_value',
    });
  });

  it('describes resend without the API key', () => {
    const settings = resolveMailConfig(reader(RESEND));
    const description = describeMailConfig(settings);
    expect(description).toBe('Mail driver: resend');
    expect(description).not.toContain('re_test_secret_key_value');
    expect(description).not.toContain('RESEND_API_KEY');
  });

  it('does not mention the API key when resend config is invalid', () => {
    try {
      resolveMailConfig(
        reader({
          NODE_ENV: 'production',
          MAIL_DRIVER: 'resend',
          MAIL_FROM: RESEND.MAIL_FROM,
          RESEND_API_KEY: '',
        }),
      );
      throw new Error('expected resolveMailConfig to throw');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('re_test');
      expect(message).toMatch(/RESEND_API_KEY/);
    }
  });

  it('accepts MAIL_DRIVER case-insensitively', () => {
    expect(resolveMailConfig(reader({ ...SMTP, MAIL_DRIVER: 'SMTP' })).driver).toBe('smtp');
    expect(resolveMailConfig(reader({ ...RESEND, MAIL_DRIVER: 'RESEND' })).driver).toBe('resend');
  });

  it('rejects MAIL_FROM with header-injection characters', () => {
    expect(() =>
      resolveMailConfig(reader({ ...SMTP, MAIL_FROM: 'AgroBridge <noreply@agrobridge.ge>\nBcc: victim@example.com' })),
    ).toThrow(/line breaks/);
  });
});

describe('sanitizeMailError', () => {
  it('redacts Bearer tokens and Resend API keys', () => {
    const text = sanitizeMailError(
      new Error('Authorization: Bearer re_test_secret_key_value RESEND_API_KEY=re_test_secret_key_value'),
      ['re_test_secret_key_value'],
    );
    expect(text).not.toContain('re_test_secret_key_value');
    expect(text).not.toMatch(/Bearer\s+re_/i);
  });

  it('strips the SMTP password and credential-bearing URLs', () => {
    const text = sanitizeMailError(
      new Error(
        'Invalid login smtp://mailer:s3cret-token-value@smtp.example.com SMTP_PASSWORD=s3cret-token-value',
      ),
      ['s3cret-token-value'],
    );
    expect(text).not.toContain('s3cret-token-value');
    expect(text).toContain('***');
  });

  it('redacts reset tokens from query strings and token= fields', () => {
    const text = sanitizeMailError(
      new Error('smtp failed https://agrobridge.ge/en/reset-password?token=opaque-reset-token token=opaque-reset-token'),
    );
    expect(text).not.toContain('opaque-reset-token');
  });
});

describe('isTransientSmtpError', () => {
  it('retries timeouts but not authentication failures', () => {
    expect(isTransientSmtpError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isTransientSmtpError({ code: 'EAUTH', responseCode: 535 })).toBe(false);
  });
});
