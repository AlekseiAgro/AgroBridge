import { parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('falls back to localhost when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:3000']);
  });

  it('falls back to localhost when blank', () => {
    expect(parseCorsOrigins('  ,  ')).toEqual(['http://localhost:3000']);
  });

  it('parses a single origin', () => {
    expect(parseCorsOrigins('https://agrobrid.ge')).toEqual([
      'https://agrobrid.ge',
    ]);
  });

  it('parses dual origins and trims whitespace', () => {
    expect(
      parseCorsOrigins('https://agrobrid.ge, https://new-domain.example'),
    ).toEqual(['https://agrobrid.ge', 'https://new-domain.example']);
  });
});
