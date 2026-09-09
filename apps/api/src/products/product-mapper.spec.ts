import { mapProductCertificates, mapProductDetail } from './product-mapper';
import type { ProductRowSlice } from './product-mapper';

const pending = {
  id: 'c-pending',
  type: 'organic',
  title: 'Organic pending',
  fileName: 'organic.pdf',
  url: 'https://cdn.example.com/products/p1/certificates/secret.pdf',
  mimeType: 'application/pdf',
  reviewStatus: 'pending',
  reviewNote: 'waiting',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const approved = {
  id: 'c-approved',
  type: 'globalGap',
  title: 'GLOBALG.A.P.',
  fileName: 'gap.pdf',
  url: 'https://cdn.example.com/products/p1/certificates/public.pdf',
  mimeType: 'application/pdf',
  reviewStatus: 'approved',
  reviewNote: null,
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
};

const rejected = {
  id: 'c-rejected',
  type: 'other',
  title: 'Rejected cert',
  fileName: 'nope.pdf',
  url: 'https://cdn.example.com/products/p1/certificates/nope.pdf',
  mimeType: 'application/pdf',
  reviewStatus: 'rejected',
  reviewNote: 'blurry scan',
  createdAt: new Date('2026-01-03T00:00:00.000Z'),
};

describe('mapProductCertificates', () => {
  it('hides pending and rejected certificates from public payloads', () => {
    const publicCerts = mapProductCertificates('p1', [pending, approved, rejected], {
      includePrivate: false,
    });
    expect(publicCerts).toHaveLength(1);
    expect(publicCerts[0].id).toBe('c-approved');
    expect(publicCerts[0].reviewStatus).toBe('approved');
    expect(publicCerts[0].reviewNote).toBeNull();
    expect(publicCerts[0].url).toBe('/api/products/p1/certificates/c-approved/file');
    expect(publicCerts[0].url).not.toContain('cdn.example.com');
    expect(JSON.stringify(publicCerts)).not.toContain('blurry scan');
    expect(JSON.stringify(publicCerts)).not.toContain('waiting');
  });

  it('lets the owner or admin see pending and rejected certificates without storage URLs', () => {
    const privateCerts = mapProductCertificates('p1', [pending, approved, rejected], {
      includePrivate: true,
    });
    expect(privateCerts.map((cert) => cert.id)).toEqual([
      'c-pending',
      'c-approved',
      'c-rejected',
    ]);
    expect(privateCerts[0].reviewNote).toBe('waiting');
    expect(privateCerts[2].reviewNote).toBe('blurry scan');
    for (const cert of privateCerts) {
      expect(cert.url).toBe(`/api/products/p1/certificates/${cert.id}/file`);
      expect(cert.url).not.toContain('cdn.example.com');
    }
  });
});

describe('mapProductDetail certificate visibility', () => {
  const product = {
    id: 'p1',
    ownerUserId: 'owner1',
    title: 'Hazelnuts',
    description: null,
    category: null,
    variety: null,
    country: null,
    originPlace: null,
    unit: null,
    minQuantity: null,
    maxQuantity: null,
    currentStock: null,
    monthlyProduction: null,
    maxAnnualProduction: null,
    seasonMonths: [],
    harvestStartAt: null,
    harvestEndAt: null,
    forecastQuantity: null,
    harvestStatus: null,
    preorderEnabled: false,
    attributes: {},
    packagingTypes: [],
    packagingWeights: [],
    palletSize: null,
    incoterms: [],
    carriers: [],
    customDelivery: null,
    nearestPort: null,
    deliveryAvailable: false,
    leadTimeDays: null,
    priceFrom: null,
    priceCurrency: null,
    priceNegotiable: false,
    priceDependsOnVolume: false,
    isPublished: true,
    moderationStatus: 'approved',
    moderationNote: null,
    images: [],
    videos: [],
    certificates: [pending, approved, rejected],
    owner: { id: 'owner1', displayName: 'Nino' },
    farm: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as unknown as ProductRowSlice & { createdAt: Date; updatedAt: Date };

  it('does not put pending certificates on public badges', () => {
    const detail = mapProductDetail(product, null, false, false, false);
    expect(detail.certificateBadges).toEqual(['globalGap']);
    expect(detail.certificates).toHaveLength(1);
  });

  it('includes pending certificates for a privileged viewer', () => {
    const detail = mapProductDetail(product, null, false, true, true);
    expect(detail.certificates).toHaveLength(3);
  });
});
