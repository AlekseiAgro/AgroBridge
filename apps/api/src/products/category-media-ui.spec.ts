import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { PRODUCT_CATEGORIES } from '@agrobridge/shared';
import { INTERNAL_DRAFT_PRODUCT_TITLES } from '@agrobridge/shared';
import {
  CATEGORY_MEDIA,
  SHOWCASE_CATEGORIES,
  getCategoryMediaUrl,
  resolveProductCategory,
} from '../../../web/src/lib/category-media';
import {
  formatCategoryFallbackAlt,
  getProductCardImage,
  getProductCardImageAlt,
} from '../../../web/src/lib/product-image';
import { publicProductWhere } from './public-product.where';

const WEB_SRC = join(__dirname, '../../../web/src');
const WEB_PUBLIC = join(__dirname, '../../../web/public');
const MESSAGES_DIR = join(__dirname, '../../../web/messages');
const LOCALES = ['en', 'ru', 'ka', 'de', 'fr', 'it', 'es'] as const;
const CATEGORY_KEYS = [
  'fruits',
  'vegetables',
  'berries',
  'nuts',
  'wine',
  'dairy',
  'honey',
  'mineralWater',
  'spices',
  'tea',
  'bayLeaf',
  'essentialOils',
  'organic',
  'other',
] as const;

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

function publicFileFor(url: string) {
  return join(WEB_PUBLIC, url.replace(/^\//, ''));
}

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function messages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    catalog: {
      categories: Record<string, string>;
      categoryAlts: Record<string, string>;
      categoryFallbackAlt: string;
    };
  };
}

describe('category media mapping', () => {
  it('maps every ProductCategory id to a dedicated public asset', () => {
    expect(Object.keys(CATEGORY_MEDIA).sort()).toEqual([...PRODUCT_CATEGORIES].sort());
    for (const category of PRODUCT_CATEGORIES) {
      const url = CATEGORY_MEDIA[category];
      expect(url.startsWith('/images/')).toBe(true);
      expect(existsSync(publicFileFor(url))).toBe(true);
    }
  });

  it('resolves images by stable category id, not labels or locale', () => {
    expect(getCategoryMediaUrl('nuts')).toBe('/images/categories/nuts.jpg');
    expect(getCategoryMediaUrl('wine')).toBe('/images/categories/wine.jpg');
    expect(getCategoryMediaUrl('mineralWater')).toBe('/images/categories/mineralWater.jpg');
    expect(getCategoryMediaUrl('Орехи')).toBe('/images/categories/other.jpg');
    expect(getCategoryMediaUrl('nuts.jpg')).toBe('/images/categories/other.jpg');
    expect(getCategoryMediaUrl('nut')).toBe('/images/categories/other.jpg');
    expect(resolveProductCategory('tea')).toBe('tea');
    expect(resolveProductCategory(null)).toBe('other');
    expect(SHOWCASE_CATEGORIES).not.toContain('other');
    expect(SHOWCASE_CATEGORIES).toHaveLength(PRODUCT_CATEGORIES.length - 1);
  });

  it('does not share one image file across unrelated showcase categories', () => {
    const hashes = SHOWCASE_CATEGORIES.map((category) => {
      const file = publicFileFor(CATEGORY_MEDIA[category]);
      return { category, hash: sha256(file), bytes: statSync(file).size };
    });

    const byHash = new Map<string, string[]>();
    for (const row of hashes) {
      byHash.set(row.hash, [...(byHash.get(row.hash) ?? []), row.category]);
    }

    const duplicates = [...byHash.entries()].filter(([, cats]) => cats.length > 1);
    expect(duplicates).toEqual([]);
    expect(byHash.size).toBe(SHOWCASE_CATEGORIES.length);
    expect(hashes.every((row) => row.bytes > 20_000 && row.bytes < 600_000)).toBe(true);
  });

  it('keeps other on its own still, independent from the restored home hero', () => {
    const otherHash = sha256(publicFileFor(CATEGORY_MEDIA.other));
    const heroHash = sha256(join(WEB_PUBLIC, 'images/hero/farm-landscape.jpg'));
    expect(CATEGORY_MEDIA.other).toBe('/images/categories/other.jpg');
    expect(existsSync(join(WEB_PUBLIC, 'images/hero/farm-landscape.jpg'))).toBe(true);
    expect(otherHash).not.toBe(heroHash);

    for (const category of SHOWCASE_CATEGORIES) {
      expect(sha256(publicFileFor(CATEGORY_MEDIA[category]))).not.toBe(otherHash);
      expect(sha256(publicFileFor(CATEGORY_MEDIA[category]))).not.toBe(heroHash);
    }
  });

  it('stores one jpeg per category including other, with no leftover unused files', () => {
    const files = readdirSync(join(WEB_PUBLIC, 'images/categories')).filter((name) =>
      name.endsWith('.jpg'),
    );
    expect(files.sort()).toEqual(
      [...SHOWCASE_CATEGORIES, 'other'].map((category) => `${category}.jpg`).sort(),
    );
  });
});

describe('product image precedence and honest fallback alt', () => {
  it('prefers an uploaded product photo over the category still', () => {
    const image = getProductCardImage({
      category: 'honey',
      images: [{ id: 'img1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true, kind: 'overview' }],
    });
    expect(image).toEqual({ url: '/api/uploads/products/p1/a.jpg', fromCategory: false });
  });

  it('falls back to the matching category still when no product photo exists', () => {
    expect(getProductCardImage({ category: 'honey', images: [] })).toEqual({
      url: '/images/categories/honey.jpg',
      fromCategory: true,
    });
    expect(getProductCardImage({ category: 'unknown-group' })).toEqual({
      url: '/images/categories/other.jpg',
      fromCategory: true,
    });
  });

  it('does not describe a category fallback as the seller product photograph', () => {
    const fallbackAlt = formatCategoryFallbackAlt('honey', (key, values) => {
      if (key === 'categories.honey') return 'Honey';
      if (key === 'categoryFallbackAlt') return `Category illustration: ${values?.category}`;
      return key;
    });
    expect(fallbackAlt).toBe('Category illustration: Honey');
    expect(fallbackAlt.toLowerCase()).not.toContain('seller');
    expect(getProductCardImageAlt({
      fromCategory: true,
      productTitle: 'Acacia honey 500g',
      categoryFallbackAlt: fallbackAlt,
    })).toBe('Category illustration: Honey');
    expect(getProductCardImageAlt({
      fromCategory: false,
      productTitle: 'Acacia honey 500g',
      categoryFallbackAlt: fallbackAlt,
    })).toBe('Acacia honey 500g');
  });
});

describe('category localization and catalog surfaces', () => {
  it('has category names, alt text, and fallback copy in all seven locales', () => {
    for (const locale of LOCALES) {
      const catalog = messages(locale).catalog;
      expect(catalog.categoryFallbackAlt).toContain('{category}');
      for (const key of CATEGORY_KEYS) {
        expect(catalog.categories[key].trim().length).toBeGreaterThan(0);
        expect(catalog.categoryAlts[key].trim().length).toBeGreaterThan(0);
      }
      if (locale !== 'ru') {
        const blob = `${Object.values(catalog.categories).join(' ')} ${Object.values(catalog.categoryAlts).join(' ')} ${catalog.categoryFallbackAlt}`;
        expect(blob).not.toMatch(/[А-Яа-яЁё]/);
      }
    }
  });

  it('wires meaningful alts into category tiles and catalog cards', () => {
    const showcase = readWeb('components/CategoryShowcase.tsx');
    const catalog = readWeb('app/[locale]/catalog/page.tsx');
    const farm = readWeb('components/FarmProfileView.tsx');
    const dashboard = readWeb('app/[locale]/dashboard/products/page.tsx');
    const detail = readWeb('app/[locale]/products/[id]/page.tsx');

    expect(showcase).toContain('categoryAlts.${category}');
    expect(showcase).not.toMatch(/alt=""/);
    expect(catalog).toContain('getProductCardImageAlt');
    expect(catalog).toContain('formatCategoryFallbackAlt');
    expect(catalog).not.toMatch(/alt=""/);
    expect(farm).toContain('getProductCardImageAlt');
    expect(dashboard).toContain('getProductCardImageAlt');
    expect(detail).toContain('getProductCardImageAlt');
    expect(detail).toContain('formatCategoryFallbackAlt');
    expect(detail).toMatch(/product\.images\.map[\s\S]*alt=\{formatProductTitle\(product\.title, locale\)\}/);
  });

  it('does not weaken public product visibility rules', () => {
    expect(publicProductWhere.isPublished).toBe(true);
    expect(publicProductWhere.moderationStatus).toBe('approved');
    expect(INTERNAL_DRAFT_PRODUCT_TITLES).toContain('Новый товар');
    expect(readWeb('app/[locale]/catalog/page.tsx')).not.toContain('isPubliclyListedProduct');
  });

  it('keeps the category section in the existing visual language without overflow-x hidden', () => {
    const css = readWeb('app/globals.css');
    const blockStart = css.indexOf('.category-showcase {');
    const blockEnd = css.indexOf('.how-it-works {', blockStart);
    const showcaseCss = css.slice(blockStart, blockEnd);

    expect(showcaseCss).toContain('aspect-ratio: 4 / 3');
    expect(showcaseCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(showcaseCss).toContain('clamp(1.7rem, 3.4vw, 2.25rem)');
    expect(showcaseCss).not.toMatch(/overflow-x:\s*hidden/);
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(css).toContain('@container marketplace (max-width: 40rem)');
  });
});
