import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const NON_EN = ['ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

const FORM_KEYS = [
  'product.formSections.basics',
  'product.formSections.media',
  'product.formSections.priceAndVolume',
  'product.videos.optionalLabel',
  'product.certificates.optionalHint',
  'product.certificates.title',
  'quality.scoreWithTier',
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

function source(rel: string): string {
  return readFileSync(join(WEB, 'src', rel), 'utf8');
}

describe('product create/edit information architecture', () => {
  const form = source('components/ProductForm.tsx');
  const editPage = source('app/[locale]/dashboard/products/[id]/edit/page.tsx');
  const images = source('components/ProductImagesManager.tsx');
  const videos = source('components/ProductVideosManager.tsx');
  const certificates = source('components/ProductCertificatesManager.tsx');
  const quality = source('components/ProductQualityWidget.tsx');

  it('keeps a single continuous form without wizard steps', () => {
    expect(form).toContain('className="auth-form product-form"');
    expect(form).not.toMatch(/Step 1|stepper|wizard/i);
    expect(form).toContain('value="save"');
    expect(form).toContain('value="publish"');
    expect(form).toContain("t('preview')");
  });

  it('orders quality, basics, media, price+volume, then certificates before publish', () => {
    expect(form.indexOf('<ProductQualityWidget')).toBeLessThan(form.indexOf("t('formSections.basics')"));
    expect(form.indexOf("t('formSections.basics')")).toBeLessThan(form.indexOf('{media}'));
    expect(form.indexOf('{media}')).toBeLessThan(form.indexOf("t('formSections.priceAndVolume')"));
    expect(form.indexOf("t('formSections.priceAndVolume')")).toBeLessThan(form.indexOf("t('sections.packaging')"));
    expect(form.indexOf("t('sections.packaging')")).toBeLessThan(form.indexOf("t('sections.logistics')"));
    expect(form.indexOf("t('sections.logistics')")).toBeLessThan(form.indexOf("th('formTitle')"));
    expect(form.indexOf("th('formTitle')")).toBeLessThan(form.indexOf('{certificates}'));
    expect(form.indexOf('{certificates}')).toBeLessThan(form.indexOf("t('publish')"));
    expect(form).toContain('compact');
  });

  it('keeps price and volume in one commercial section and out of basics', () => {
    const basics = form.slice(
      form.indexOf("t('formSections.basics')"),
      form.indexOf('{media}'),
    );
    expect(basics).toContain("t('title')");
    expect(basics).toContain("t('category')");
    expect(basics).toContain("t('variety')");
    expect(basics).toContain("t('description')");
    expect(basics).not.toContain('priceFrom');
    expect(basics).not.toContain('PRICE_CURRENCIES');

    const commerce = form.slice(
      form.indexOf("t('formSections.priceAndVolume')"),
      form.indexOf("t('sections.packaging')"),
    );
    expect(commerce).toContain("t('priceFrom')");
    expect(commerce).toContain('PRICE_CURRENCIES.map');
    expect(commerce).toContain("['currentStock', currentStock, setCurrentStock]");
    expect(commerce).toContain("['monthlyProduction', monthlyProduction, setMonthlyProduction]");
    expect(commerce).toContain("['maxAnnualProduction', maxAnnualProduction, setMaxAnnualProduction]");
    expect(commerce).toContain("['minQuantity', minQuantity, setMinQuantity]");
    expect(commerce).toContain("['maxQuantity', maxQuantity, setMaxQuantity]");
    expect(form).toContain('initial?.priceCurrency ?? DEFAULT_PRODUCT_CURRENCY');
    expect(form).not.toContain("?? 'EUR'");
  });

  it('combines photos and video on the edit page and keeps upload contracts', () => {
    expect(editPage).toContain("t('formSections.media')");
    expect(editPage).toContain('ProductImagesManager');
    expect(editPage).toContain('ProductVideosManager');
    expect(editPage).toContain('embedded');
    expect(editPage.indexOf('ProductImagesManager')).toBeLessThan(editPage.indexOf('ProductVideosManager'));
    expect(editPage.indexOf('media=')).toBeLessThan(editPage.indexOf('certificates='));
    expect(editPage).not.toContain('leading=');

    expect(images).toContain('`/api/products/${productId}/images`');
    expect(images).toContain('/primary');
    expect(images).toContain('PRODUCT_IMAGE_MAX_COUNT');
    expect(videos).toContain('`/api/products/${productId}/videos`');
    expect(videos).toContain('PRODUCT_VIDEO_MAX_COUNT');
    expect(videos).toContain("t('videos.optionalLabel')");
    expect(certificates).toContain('`/api/products/${productId}/certificates`');
    expect(certificates).toContain("t('certificates.optionalHint')");
  });

  it('does not change quality scoring or hide the widget', () => {
    expect(form).toContain('computeProductQualityScore');
    expect(quality).toContain('score.checklist');
    expect(quality).toContain("t('nextHint')");
    expect(quality).toContain('compact');
    expect(quality).not.toContain('computeProductQualityScore(');
  });

  it.each(LOCALES)('%s has the new product-form IA keys', (locale) => {
    const data = messages(locale);
    for (const key of FORM_KEYS) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(NON_EN)('%s does not leave new form IA keys in English', (locale) => {
    const data = messages(locale);
    const en = messages('en');
    const leftover: string[] = [];
    for (const key of FORM_KEYS) {
      if (key === 'quality.scoreWithTier') continue;
      if (read(data, key) === read(en, key)) leftover.push(key);
    }
    expect(leftover).toEqual([]);
  });
});
