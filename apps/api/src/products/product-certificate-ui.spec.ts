import { computeProductQualityScore, type QualityScoreInput } from '@agrobridge/shared';
import {
  isAuthorizedCertificateHref,
  ownerCertificateFileHref,
} from '../../../web/src/lib/product-certificate-ui';
import { readFileSync } from 'fs';
import { join } from 'path';

const emptyQuality = (): QualityScoreInput => ({
  title: 'Hazelnuts',
  category: 'nuts',
  imageCount: 0,
  imageKinds: [],
  videoCount: 0,
  hasSeasonality: false,
  attributes: {},
  packagingTypes: [],
  packagingWeights: [],
  certificateCount: 0,
  approvedCertificateCount: 0,
  incoterms: [],
  carriers: [],
});

describe('ownerCertificateFileHref', () => {
  it('builds the authorized BFF path and never a CDN or uploads URL', () => {
    const href = ownerCertificateFileHref('prod1', 'cert1');
    expect(href).toBe('/api/products/prod1/certificates/cert1/file');
    expect(isAuthorizedCertificateHref(href)).toBe(true);
    expect(href).not.toContain('media.agrobridge.ge');
    expect(href).not.toContain('/api/uploads/');
    expect(href).not.toContain('products/prod1/certificates/uuid.pdf');
  });

  it('rejects leftover public storage URLs', () => {
    expect(isAuthorizedCertificateHref('https://cdn.example.com/products/p1/certificates/c.pdf')).toBe(
      false,
    );
    expect(isAuthorizedCertificateHref('/api/uploads/products/p1/certificates/c.pdf')).toBe(false);
    expect(isAuthorizedCertificateHref('products/p1/certificates/c.pdf')).toBe(false);
  });
});

describe('computeProductQualityScore certificates', () => {
  it('does not treat a pending-only upload as an approved certificate', () => {
    const score = computeProductQualityScore({
      ...emptyQuality(),
      certificateCount: 2,
      approvedCertificateCount: 0,
    });
    const item = score.checklist.find((entry) => entry.id === 'certificates');
    expect(item?.done).toBe(false);
    expect(item?.earned).toBe(0);
    expect(score.suggestions).toContain('certificates');
  });

  it('treats an approved certificate as complete', () => {
    const score = computeProductQualityScore({
      ...emptyQuality(),
      certificateCount: 1,
      approvedCertificateCount: 1,
    });
    const item = score.checklist.find((entry) => entry.id === 'certificates');
    expect(item?.done).toBe(true);
    expect(item?.earned).toBe(10);
  });

  it('does not treat a rejected certificate as complete', () => {
    const score = computeProductQualityScore({
      ...emptyQuality(),
      certificateCount: 1,
      approvedCertificateCount: 0,
    });
    const item = score.checklist.find((entry) => entry.id === 'certificates');
    expect(item?.done).toBe(false);
    expect(item?.earned).toBe(0);
  });
});

describe('ProductCertificatesManager wiring', () => {
  const webRoot = join(__dirname, '../../../web/src');

  it('is rendered once on the product edit page after the product exists', () => {
    const editPage = readFileSync(
      join(webRoot, 'app/[locale]/dashboard/products/[id]/edit/page.tsx'),
      'utf8',
    );
    expect(editPage).toContain("from '@/components/ProductCertificatesManager'");
    expect(editPage.match(/<ProductCertificatesManager\b/g)?.length).toBe(1);
    expect(editPage).toContain('initialCertificates={product.certificates}');
    expect(editPage).toContain('ProductImagesManager');
    expect(editPage).toContain('ProductVideosManager');
  });

  it('is not rendered on create-redirect or farm pages', () => {
    const newPage = readFileSync(
      join(webRoot, 'app/[locale]/dashboard/products/new/page.tsx'),
      'utf8',
    );
    const farmPage = readFileSync(join(webRoot, 'app/[locale]/dashboard/farm/page.tsx'), 'utf8');
    expect(newPage).not.toContain('ProductCertificatesManager');
    expect(farmPage).not.toContain('ProductCertificatesManager');
  });

  it('uploads and deletes through existing BFF routes without public media URLs', () => {
    const source = readFileSync(join(webRoot, 'components/ProductCertificatesManager.tsx'), 'utf8');
    expect(source).toContain('export function ProductCertificatesManager');
    expect(source).toContain('`/api/products/${productId}/certificates`');
    expect(source).toContain('method: \'POST\'');
    expect(source).toContain('method: \'DELETE\'');
    expect(source).toContain('certificates.status.${cert.reviewStatus}');
    expect(source).not.toContain('toPublicMediaUrl');
    expect(source).toContain('ownerCertificateFileHref');
    expect(source.match(/export function ProductCertificatesManager/g)?.length).toBe(1);
  });
});
