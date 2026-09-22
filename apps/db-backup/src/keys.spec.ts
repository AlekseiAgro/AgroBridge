import { dumpObjectKey, metadataObjectKey, resolveKinds, utcStamp } from './keys';

describe('backup object keys', () => {
  it('uses a unique UTC stamp and never reuses the same path', () => {
    const first = new Date('2026-09-22T02:01:13.000Z');
    const second = new Date('2026-09-22T02:01:14.000Z');
    expect(utcStamp(first)).toBe('20260922T020113Z');
    expect(dumpObjectKey({ environment: 'production', kind: 'daily', createdAt: first })).toBe(
      'production/daily/agrobridge-production-20260922T020113Z.dump',
    );
    expect(dumpObjectKey({ environment: 'production', kind: 'manual', createdAt: second })).toBe(
      'production/manual/agrobridge-production-20260922T020114Z.dump',
    );
  });

  it('pairs metadata next to the dump', () => {
    expect(metadataObjectKey('production/daily/agrobridge-production-20260922T020113Z.dump')).toBe(
      'production/daily/agrobridge-production-20260922T020113Z.json',
    );
  });

  it('rejects path traversal in dump keys', () => {
    expect(() => metadataObjectKey('../secret.dump')).toThrow(/Invalid dump object key/);
  });

  it('promotes Sunday daily backups to weekly and the 1st to monthly', () => {
    expect(resolveKinds({ kind: 'daily', createdAt: new Date('2026-09-20T02:00:00Z') })).toEqual([
      'daily',
      'weekly',
    ]);
    expect(resolveKinds({ kind: 'daily', createdAt: new Date('2026-09-01T02:00:00Z') })).toEqual([
      'daily',
      'monthly',
    ]);
    expect(resolveKinds({ kind: 'manual', createdAt: new Date('2026-09-20T02:00:00Z') })).toEqual([
      'manual',
    ]);
  });
});
