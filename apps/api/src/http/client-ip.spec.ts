import { clientIpOf, resolveTrustProxyHops, UNKNOWN_IP } from './client-ip';

describe('resolveTrustProxyHops', () => {
  it('trusts nothing in development', () => {
    expect(resolveTrustProxyHops({} as NodeJS.ProcessEnv)).toBe(0);
  });

  it('trusts the single documented proxy in production', () => {
    expect(resolveTrustProxyHops({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(1);
  });

  it('honours an explicit depth', () => {
    expect(
      resolveTrustProxyHops({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '2' } as NodeJS.ProcessEnv),
    ).toBe(2);
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '0' } as NodeJS.ProcessEnv)).toBe(0);
  });

  it('refuses values that would trust a forged header chain', () => {
    for (const value of ['-1', '99', 'true', 'many', '1.5']) {
      expect(() =>
        resolveTrustProxyHops({ TRUST_PROXY_HOPS: value } as NodeJS.ProcessEnv),
      ).toThrow(/TRUST_PROXY_HOPS/);
    }
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
