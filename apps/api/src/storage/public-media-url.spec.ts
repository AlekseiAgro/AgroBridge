import {
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
    expect(toPublicMediaUrl(key)).toBe(key);
    expect(toPublicMediaUrl(key)).not.toContain('/api/uploads/');
  });
});
