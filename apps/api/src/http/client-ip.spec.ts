import { clientIpOf, describeTrustProxy, resolveTrustProxy, UNKNOWN_IP } from './client-ip';

describe('resolveTrustProxy', () => {
  it('trusts nothing in development', () => {
    expect(resolveTrustProxy({} as NodeJS.ProcessEnv)).toBe(0);
  });

  it('trusts our own infrastructure ranges in production', () => {
    expect(resolveTrustProxy({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toEqual([
      'loopback',
      'linklocal',
      'uniquelocal',
    ]);
  });

  it('honours an explicit hop count', () => {
    expect(
      resolveTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: '2' } as NodeJS.ProcessEnv),
    ).toBe(2);
    expect(resolveTrustProxy({ TRUST_PROXY: '0' } as NodeJS.ProcessEnv)).toBe(0);
  });

  it('honours an explicit proxy list', () => {
    expect(
      resolveTrustProxy({ TRUST_PROXY: 'loopback, 203.0.113.7 ' } as NodeJS.ProcessEnv),
    ).toEqual(['loopback', '203.0.113.7']);
    expect(resolveTrustProxy({ TRUST_PROXY: '10.0.0.0/8' } as NodeJS.ProcessEnv)).toEqual([
      '10.0.0.0/8',
    ]);
  });

  it('refuses values that would trust a forged header chain', () => {
    for (const value of ['-1', '99', 'true', 'many', ',', 'loopback,nonsense']) {
      expect(() => resolveTrustProxy({ TRUST_PROXY: value } as NodeJS.ProcessEnv)).toThrow(
        /TRUST_PROXY/,
      );
    }
  });

  it('refuses ranges covering every address, which any client could claim to be', () => {
    for (const value of [
      '0.0.0.0/0',
      '::/0',
      '0.0.0.0',
      '::',
      'loopback,0.0.0.0/0',
      '10.0.0.0/0',
    ]) {
      expect(() => resolveTrustProxy({ TRUST_PROXY: value } as NodeJS.ProcessEnv)).toThrow(
        /would trust every address/,
      );
    }
  });

  it('still accepts the private ranges the BFF reaches us from', () => {
    expect(
      resolveTrustProxy({ TRUST_PROXY: 'fd12::/16,10.0.0.0/8' } as NodeJS.ProcessEnv),
    ).toEqual(['fd12::/16', '10.0.0.0/8']);
  });

  it('describes both forms for the boot log', () => {
    expect(describeTrustProxy(2)).toBe('2 hop(s)');
    expect(describeTrustProxy(['loopback', 'uniquelocal'])).toBe('loopback, uniquelocal');
  });
});

describe('clientIpOf', () => {
  it('uses the address Express resolved', () => {
    expect(clientIpOf({ ip: '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('falls back to the socket peer', () => {
    expect(clientIpOf({ socket: { remoteAddress: '10.0.0.1' } })).toBe('10.0.0.1');
  });

  it('buckets unidentifiable callers together rather than exempting them', () => {
    expect(clientIpOf({})).toBe(UNKNOWN_IP);
    expect(clientIpOf({ ip: '   ', socket: { remoteAddress: null } })).toBe(UNKNOWN_IP);
  });
});
