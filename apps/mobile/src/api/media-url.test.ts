import { joinApiUrl, resolveApiBaseUrl } from './config';
import { resolveMediaUrl } from './media-url';

const API = 'https://api.agrobridge.ge/api';

describe('resolveMediaUrl', () => {
  it('prefixes relative upload paths with the API host once', () => {
    expect(resolveMediaUrl('/api/uploads/products/a.jpg', API)).toBe(
      'https://api.agrobridge.ge/api/uploads/products/a.jpg',
    );
    expect(resolveMediaUrl('/api/uploads/products/a.jpg', `${API}/`)).toBe(
      'https://api.agrobridge.ge/api/uploads/products/a.jpg',
    );
  });

  it('leaves absolute and CDN URLs unchanged', () => {
    const cdn = 'https://cdn.example.com/products/a.jpg';
    expect(resolveMediaUrl(cdn, API)).toBe(cdn);
    expect(resolveMediaUrl('http://cdn.example.com/a.jpg', API)).toBe(
      'http://cdn.example.com/a.jpg',
    );
  });

  it('does not rewrite protocol-relative URLs onto the API host', () => {
    expect(resolveMediaUrl('//cdn.example.com/a.jpg', API)).toBe('//cdn.example.com/a.jpg');
  });

  it('returns null for empty values', () => {
    expect(resolveMediaUrl(null, API)).toBeNull();
    expect(resolveMediaUrl('   ', API)).toBeNull();
  });
});

describe('joinApiUrl', () => {
  it('does not duplicate the /api prefix', () => {
    expect(joinApiUrl(API, '/auth/login')).toBe('https://api.agrobridge.ge/api/auth/login');
    expect(joinApiUrl(API, '/api/auth/login')).toBe('https://api.agrobridge.ge/api/auth/login');
  });

  it('falls back to the public API origin', () => {
    expect(resolveApiBaseUrl('  ')).toBe(API);
    expect(resolveApiBaseUrl(undefined)).toBe(API);
  });
});
