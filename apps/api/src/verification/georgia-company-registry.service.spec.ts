import { ConfigService } from '@nestjs/config';
import { GeorgiaCompanyRegistryService } from './georgia-company-registry.service';

function serviceWith(env: Record<string, string | undefined>): GeorgiaCompanyRegistryService {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new GeorgiaCompanyRegistryService(config);
}

describe('GeorgiaCompanyRegistryService', () => {
  describe('development', () => {
    it('invents a legal name so the local flow has something to show', async () => {
      const result = await serviceWith({ NODE_ENV: 'development' }).lookup('123456789');

      expect(result.valid).toBe(true);
      expect(result.confirmed).toBe(true);
      expect(result.source).toBe('stub');
      expect(result.legalName).toBe('Registry stub company 123456789');
    });

    it('still refuses a malformed identification code', async () => {
      const result = await serviceWith({ NODE_ENV: 'development' }).lookup('1234567');

      expect(result.valid).toBe(false);
      expect(result.confirmed).toBe(false);
      expect(result.legalName).toBeNull();
    });
  });

  describe('production', () => {
    it('never presents a made-up nine-digit code as a confirmed registry match', async () => {
      const result = await serviceWith({ NODE_ENV: 'production' }).lookup('404123456');

      // The code is recorded so the company can still apply, but nothing about the answer
      // can be read as a registry that confirmed the company.
      expect(result.source).toBe('unverified');
      expect(result.legalName).toBeNull();
      expect(result.message).toContain('not verified');
    });

    it('reports no confirmation, which is what the verification gate reads', async () => {
      const result = await serviceWith({ NODE_ENV: 'production' }).lookup('404123456');

      // Null, not false: nothing was refused, nothing was confirmed. `true` here would let
      // nine digits approve a company on their own.
      expect(result.confirmed).toBeNull();
      expect(result.valid).toBe(true);
    });

    it('keeps rejecting a malformed identification code', async () => {
      const result = await serviceWith({ NODE_ENV: 'production' }).lookup('12345');

      expect(result.valid).toBe(false);
      expect(result.confirmed).toBe(false);
      expect(result.source).toBe('unverified');
      expect(result.message).toBe('Identification code must be exactly 9 digits');
    });

    it('only invents a legal name when an operator explicitly asks for the stub', async () => {
      const result = await serviceWith({
        NODE_ENV: 'production',
        GEORGIA_REGISTRY_MODE: 'stub',
      }).lookup('123456789');

      expect(result.source).toBe('stub');
      expect(result.confirmed).toBe(true);
      expect(result.legalName).toBe('Registry stub company 123456789');
    });

    it('falls back to the safe mode when the configured mode is not recognised', async () => {
      const result = await serviceWith({
        NODE_ENV: 'production',
        GEORGIA_REGISTRY_MODE: 'napr',
      }).lookup('123456789');

      expect(result.source).toBe('unverified');
      expect(result.confirmed).toBeNull();
      expect(result.legalName).toBeNull();
    });
  });

  it('honours the forced failure mode in any environment', async () => {
    const result = await serviceWith({
      NODE_ENV: 'production',
      GEORGIA_REGISTRY_MODE: 'fail',
    }).lookup('123456789');

    expect(result.valid).toBe(false);
    expect(result.confirmed).toBe(false);
    expect(result.source).toBe('fail');
  });
});
