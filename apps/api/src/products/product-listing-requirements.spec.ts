import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  LISTING_REQUIRED_FIELDS,
  isListingComplete,
  listingRequirementIssues,
  publishedListingIncompleteMessage,
  publishedListingIssues,
} from '@agrobridge/shared';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const I18N_KEYS = [
  'product.requiredMark',
  'product.requiredToPublish',
  'product.listingRequiredHint',
  'product.listingErrors.title',
  'product.listingErrors.category',
  'product.listingErrors.unit',
  'product.listingErrors.priceFrom',
  'product.listingErrors.priceCurrency',
] as const;

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

const complete = {
  title: 'Kakheti hazelnuts',
  category: 'nuts',
  unit: 'kg',
  priceFrom: 4.2,
  priceCurrency: 'GEL',
};

describe('listingRequirementIssues', () => {
  it('accepts a complete published listing and allows empty optional fields', () => {
    expect(listingRequirementIssues(complete)).toEqual([]);
    expect(isListingComplete(complete)).toBe(true);
    expect(LISTING_REQUIRED_FIELDS).toEqual([
      'title',
      'category',
      'unit',
      'priceFrom',
      'priceCurrency',
    ]);
  });

  it('rejects a missing or draft title', () => {
    expect(listingRequirementIssues({ ...complete, title: '' })).toEqual(['title']);
    expect(listingRequirementIssues({ ...complete, title: 'Untitled product' })).toEqual([
      'title',
    ]);
    expect(listingRequirementIssues({ ...complete, title: 'Новый товар' })).toEqual(['title']);
    expect(listingRequirementIssues({ ...complete, title: 'X' })).toEqual(['title']);
  });

  it('rejects a missing price, category, unit, or currency', () => {
    expect(listingRequirementIssues({ ...complete, category: null })).toEqual(['category']);
    expect(listingRequirementIssues({ ...complete, unit: '' })).toEqual(['unit']);
    expect(listingRequirementIssues({ ...complete, priceFrom: null })).toEqual(['priceFrom']);
    expect(listingRequirementIssues({ ...complete, priceFrom: 0 })).toEqual(['priceFrom']);
    expect(listingRequirementIssues({ ...complete, priceCurrency: null })).toEqual([
      'priceCurrency',
    ]);
  });

  it('does not treat description, quantity, or farm as required', () => {
    expect(
      listingRequirementIssues({
        ...complete,
      }),
    ).toEqual([]);
  });
});

describe('publishedListingIssues', () => {
  it('never blocks draft saves', () => {
    expect(
      publishedListingIssues({
        nextPublished: false,
        next: { title: 'Untitled product' },
      }),
    ).toEqual([]);
  });

  it('requires a complete listing on first publish', () => {
    expect(
      publishedListingIssues({
        nextPublished: true,
        next: { title: 'Hazelnuts' },
        previousPublished: false,
      }),
    ).toEqual(['category', 'unit', 'priceFrom', 'priceCurrency']);
  });

  it('grandfathers already-published incomplete listings unless a field is newly broken', () => {
    const incomplete = { title: 'Hazelnuts' };
    expect(
      publishedListingIssues({
        nextPublished: true,
        next: { ...incomplete, title: 'Updated hazelnuts' },
        previousPublished: true,
        previous: incomplete,
      }),
    ).toEqual([]);
    expect(
      publishedListingIssues({
        nextPublished: true,
        next: { title: 'Untitled product', category: 'nuts', unit: 'kg', priceFrom: 2, priceCurrency: 'GEL' },
        previousPublished: true,
        previous: complete,
      }),
    ).toEqual(['title']);
  });

  it('builds a stable API message', () => {
    expect(publishedListingIncompleteMessage(['title', 'priceFrom'])).toContain('Missing: title, priceFrom');
  });
});

describe('product form listing requirements', () => {
  const form = readFileSync(join(WEB, 'src/components/ProductForm.tsx'), 'utf8');

  it('reuses the shared listing helper and blocks invalid publish before fetch', () => {
    expect(form).toContain('listingRequirementIssues');
    expect(form).toContain('publishedListingIssues');
    expect(form).toContain("intent === 'publish'");
    expect(form).toContain("t(`listingErrors.${issue}`)");
    expect(form.indexOf('listingRequirementIssues')).toBeLessThan(form.indexOf('await fetch('));
  });

  it('marks existing required fields without adding HTML required on publish-only fields', () => {
    expect(form).toContain("t('requiredMark')");
    expect(form).toContain("t('requiredToPublish')");
    expect(form).toContain("t('listingRequiredHint')");
    expect(form).toContain("t('title')");
    expect(form).toContain("t('category')");
    expect(form).toContain("t('priceFrom')");
    expect(form).toContain("t('priceCurrency')");
    expect(form).toMatch(/name="title"[\s\S]*\n\s+required/);
    expect(form).not.toMatch(/name="category"[\s\S]{0,240}\n\s+required\b/);
    expect(form).not.toMatch(/name="unit"[\s\S]{0,240}\n\s+required\b/);
    expect(form).not.toMatch(/name="priceFrom"[\s\S]{0,240}\n\s+required\b/);
    expect(form).toContain('aria-required="true"');
  });
});

describe('product DTO still allows incomplete drafts', () => {
  it('accepts a title-only create and optional listing fields', async () => {
    const createErrors = await validate(plainToInstance(CreateProductDto, { title: 'Hazelnuts' }));
    expect(createErrors).toEqual([]);

    const updateErrors = await validate(
      plainToInstance(UpdateProductDto, { description: 'Optional note' }),
    );
    expect(updateErrors).toEqual([]);
  });

  it('still requires a title string on create at the DTO layer', async () => {
    const errors = await validate(plainToInstance(CreateProductDto, { isPublished: true }));
    expect(errors.some((error) => error.property === 'title')).toBe(true);
  });
});

describe('listing requirement i18n', () => {
  it.each(LOCALES)('%s has listing requirement keys', (locale) => {
    const data = messages(locale);
    for (const key of I18N_KEYS) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(['ka', 'ru', 'de', 'fr', 'it', 'es'] as const)(
    '%s does not leave listing keys in English',
    (locale) => {
      const data = messages(locale);
      const en = messages('en');
      const leftover: string[] = [];
      for (const key of I18N_KEYS) {
        if (key === 'product.requiredMark') continue;
        if (read(data, key) === read(en, key)) leftover.push(key);
      }
      expect(leftover).toEqual([]);
    },
  );
});
