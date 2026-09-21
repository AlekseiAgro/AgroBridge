import { readFileSync } from 'fs';
import { join } from 'path';
import { CATEGORY_MEDIA, getCategoryMediaUrl } from '../../../web/src/lib/category-media';
import {
  getProductCardImage,
  getProductCardImageAlt,
  getRenderableProductImages,
  isCategoryMediaUrl,
  resolveProductImageUrl,
} from '../../../web/src/lib/product-image';

const WEB_SRC = join(__dirname, '../../../web/src');
const samplePhoto = {
  id: 'img1',
  url: '/api/uploads/products/p1/a.jpg',
  sortOrder: 0,
  isPrimary: true,
  kind: 'overview' as const,
};

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

describe('product image honesty', () => {
  it('returns the product-specific photograph when one exists', () => {
    expect(
      getProductCardImage({
        category: 'organic',
        images: [samplePhoto],
      }),
    ).toEqual({ url: '/api/uploads/products/p1/a.jpg' });
  });

  it('uses a null result, not a category still, when the product has no photo', () => {
    expect(getProductCardImage({ category: 'honey', images: [] })).toBeNull();
    expect(getProductCardImage({ category: 'organic' })).toBeNull();
    expect(getProductCardImage({ category: 'fruits', images: null })).toBeNull();
  });

  it('treats empty, whitespace, certificate, and unresolvable URLs as missing photos', () => {
    expect(resolveProductImageUrl('')).toBeNull();
    expect(resolveProductImageUrl('   ')).toBeNull();
    expect(resolveProductImageUrl(null)).toBeNull();
    expect(resolveProductImageUrl(undefined)).toBeNull();
    expect(
      getProductCardImage({
        category: 'wine',
        images: [{ ...samplePhoto, url: '' }],
      }),
    ).toBeNull();
    expect(
      getProductCardImage({
        category: 'wine',
        images: [{ ...samplePhoto, url: '/api/uploads/products/p1/certificates/haccp.pdf' }],
      }),
    ).toBeNull();
  });

  it('never resolves a product fallback to a category showcase image', () => {
    expect(getCategoryMediaUrl('organic')).toBe('/images/categories/organic.jpg');
    expect(getCategoryMediaUrl('honey')).toBe('/images/categories/honey.jpg');
    expect(isCategoryMediaUrl('/images/categories/organic.jpg')).toBe(true);
    expect(isCategoryMediaUrl('https://cdn.example/images/categories/honey.jpg')).toBe(true);
    expect(isCategoryMediaUrl('/api/uploads/products/p1/a.jpg')).toBe(false);

    expect(
      getProductCardImage({
        category: 'organic',
        images: [{ ...samplePhoto, url: '/images/categories/organic.jpg' }],
      }),
    ).toBeNull();
    expect(resolveProductImageUrl(CATEGORY_MEDIA.honey)).toBeNull();
    expect(getProductCardImage({ category: 'vegetables', images: [] })?.url).not.toBe(
      CATEGORY_MEDIA.vegetables,
    );
  });

  it('keeps category cards on the dedicated category stills', () => {
    const showcase = readWeb('components/CategoryShowcase.tsx');
    expect(showcase).toContain('CATEGORY_MEDIA[category]');
    expect(showcase).toContain('categoryAlts.${category}');
    expect(readWeb('lib/product-image.ts')).not.toMatch(
      /getProductCardImage[\s\S]*getCategoryMediaUrl/,
    );
  });

  it('preserves own-image behavior when a photograph exists', () => {
    const secondary = {
      ...samplePhoto,
      id: 'img2',
      url: '/api/uploads/products/p1/b.jpg',
      isPrimary: false,
      sortOrder: 1,
    };
    expect(getProductCardImage({ images: [secondary, samplePhoto] })).toEqual({
      url: '/api/uploads/products/p1/a.jpg',
    });
    expect(getRenderableProductImages([samplePhoto, secondary]).map((image) => image.url)).toEqual([
      '/api/uploads/products/p1/a.jpg',
      '/api/uploads/products/p1/b.jpg',
    ]);
    expect(
      getRenderableProductImages([
        { ...samplePhoto, url: '/images/categories/wine.jpg' },
        secondary,
      ]).map((image) => image.url),
    ).toEqual(['/api/uploads/products/p1/b.jpg']);
  });

  it('uses localized missing-photo alt text instead of the product title', () => {
    expect(
      getProductCardImageAlt({
        hasProductPhoto: false,
        productTitle: 'Organic wildflower honey',
        noPhotoAlt: 'No product photo available',
      }),
    ).toBe('No product photo available');
  });
});

describe('product surfaces refuse category-photo fallbacks', () => {
  it('renders the shared placeholder on catalog, farm, dashboard, detail, and harvest watches', () => {
    const catalog = readWeb('app/[locale]/catalog/page.tsx');
    const farm = readWeb('components/FarmProfileView.tsx');
    const dashboard = readWeb('app/[locale]/dashboard/products/page.tsx');
    const detail = readWeb('app/[locale]/products/[id]/page.tsx');
    const watches = readWeb('components/HarvestWatchesList.tsx');

    for (const source of [catalog, farm, dashboard, detail, watches]) {
      expect(source).toContain('ProductPhotoPlaceholder');
      expect(source).not.toContain('fromCategory');
    }
    expect(detail).toContain('getRenderableProductImages');
    expect(watches).toContain('resolveProductImageUrl');
  });
});
