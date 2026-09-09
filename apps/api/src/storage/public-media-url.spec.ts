import {
  isFarmVerificationObjectUrl,
  isLegacyFarmDocumentUploadUrl,
  toPublicMediaUrl,
} from '../../../web/src/lib/public-media-url';

describe('toPublicMediaUrl', () => {
  it('rewrites public product and farm photo uploads to a same-origin path', () => {
    expect(toPublicMediaUrl('https://api.example/api/uploads/products/p1/a.jpg')).toBe(
      '/api/uploads/products/p1/a.jpg',
    );
    expect(toPublicMediaUrl('/api/uploads/farms/farm1/photos/a.jpg')).toBe(
      '/api/uploads/farms/farm1/photos/a.jpg',
    );
    expect(toPublicMediaUrl('/api/uploads/users/u1/a.webp')).toBe('/api/uploads/users/u1/a.webp');
  });

  it('does not turn a legacy farm-document uploads path into public media', () => {
    const legacy = '/api/uploads/farms/farm1/documents/9f0e.bin';
    expect(isLegacyFarmDocumentUploadUrl(legacy)).toBe(true);
    expect(toPublicMediaUrl(legacy)).toBe('');
    expect(toPublicMediaUrl(`https://api.agrobridge.ge${legacy}`)).toBe('');
  });

  it('leaves the protected farm-document route unchanged', () => {
    expect(toPublicMediaUrl('/api/farms/documents/doc1/file')).toBe(
      '/api/farms/documents/doc1/file',
    );
  });

  it('does not prefix a private storage key as /api/uploads', () => {
    const key = 'farms/farm1/documents/abc.pdf';
    expect(isFarmVerificationObjectUrl(key)).toBe(true);
    expect(toPublicMediaUrl(key)).toBe('');
    expect(toPublicMediaUrl(key)).not.toContain('/api/uploads/');
  });

  it('leaves CDN/R2 public media URLs unchanged so they skip /api/uploads', () => {
    expect(toPublicMediaUrl('https://cdn.example.com/farms/farm1/photos/a.jpg')).toBe(
      'https://cdn.example.com/farms/farm1/photos/a.jpg',
    );
    expect(toPublicMediaUrl('https://cdn.example.com/products/p1/a.jpg')).toBe(
      'https://cdn.example.com/products/p1/a.jpg',
    );
    expect(toPublicMediaUrl('https://cdn.example.com/products/p1/videos/v.bin')).toBe(
      'https://cdn.example.com/products/p1/videos/v.bin',
    );
    expect(toPublicMediaUrl('https://cdn.example.com/users/u1/a.webp')).toBe(
      'https://cdn.example.com/users/u1/a.webp',
    );
  });

  it('does not expose product certificates as public CDN or uploads media', () => {
    expect(toPublicMediaUrl('https://cdn.example.com/products/p1/certificates/c.pdf')).toBe('');
    expect(toPublicMediaUrl('/api/uploads/products/p1/certificates/c.pdf')).toBe('');
    expect(toPublicMediaUrl('products/p1/certificates/c.pdf')).toBe('');
  });

  it('leaves the authorized certificate download path unchanged', () => {
    expect(toPublicMediaUrl('/api/products/p1/certificates/c1/file')).toBe(
      '/api/products/p1/certificates/c1/file',
    );
  });
});
