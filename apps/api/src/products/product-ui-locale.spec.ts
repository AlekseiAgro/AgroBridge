import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const NON_EN = ['ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

/** Spellings that are the same word in English and the locale. */
const COGNATES = new Set(['it:product.no', 'es:product.no']);

const REQUIRED_KEYS = [
  'farm.verification.badge',
  'farm.verification.badgeHint',
  'product.sections.basics',
  'product.sections.volume',
  'product.sections.attributes',
  'product.sections.logistics',
  'product.sections.pricing',
  'product.sections.farmStory',
  'product.variety',
  'product.currentStock',
  'product.country',
  'product.originPlace',
  'product.monthlyProduction',
  'product.maxAnnualProduction',
  'product.yes',
  'product.no',
  'product.deliveryAvailableLabel',
  'product.priceFrom',
  'product.videos.publicTitle',
  'quality.title',
  'quality.scoreLabel',
  'quality.tiers.low',
  'quality.tiers.fair',
  'quality.tiers.good',
  'quality.tiers.excellent',
  'quality.certificates.organic',
  'quality.certificates.other',
  'harvest.title',
  'harvest.preorderBadge',
  'harvest.status.available',
  'harvest.status.growing',
  'harvest.status.limited',
  'harvest.status.soldOut',
  'harvest.months.1',
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

function source(name: string): string {
  return readFileSync(join(WEB, 'src', name), 'utf8');
}

describe('public product UI localization (S1)', () => {
  const en = messages('en');

  it('keeps English as the canonical source for the audited chrome', () => {
    expect(read(en, 'farm.verification.badge')).toBe('Verified');
    expect(read(en, 'product.sections.basics')).toBe('Product basics');
    expect(read(en, 'product.sections.volume')).toBe('Available volume');
    expect(read(en, 'product.variety')).toBe('Variety');
    expect(read(en, 'product.currentStock')).toBe('Current stock');
    expect(read(en, 'quality.tiers.fair')).toBe('Fair');
  });

  it.each(LOCALES)('%s contains every required product UI key', (locale) => {
    const data = messages(locale);
    for (const key of REQUIRED_KEYS) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
  });

  it.each(NON_EN)('%s does not fall back to English for product UI chrome', (locale) => {
    const data = messages(locale);
    const leftover: string[] = [];
    for (const key of REQUIRED_KEYS) {
      if (COGNATES.has(`${locale}:${key}`)) continue;
      if (read(data, key) === read(en, key)) leftover.push(key);
    }
    expect(leftover).toEqual([]);
  });

  it('wires catalog, detail, and farm product chrome to shared keys', () => {
    const badge = source('components/VerifiedBadge.tsx');
    expect(badge).toContain("useTranslations('farm.verification')");
    expect(badge).toContain("t('badge')");

    const chip = source('components/QualityScoreChip.tsx');
    expect(chip).toContain("useTranslations('quality')");
    expect(chip).toContain('t(`tiers.${score.tier}`)');
    expect(chip).toContain("t('title')");

    const certs = source('components/CertificateBadges.tsx');
    expect(certs).toContain("useTranslations('quality')");
    expect(certs).toContain('t(`certificates.${badge}`)');

    const harvest = source('components/HarvestStatusBadge.tsx');
    expect(harvest).toContain("useTranslations('harvest')");
    expect(harvest).toContain("t('preorderBadge')");

    const detail = source('app/[locale]/products/[id]/page.tsx');
    expect(detail).toContain("t('sections.basics')");
    expect(detail).toContain("t('sections.volume')");
    expect(detail).toContain("t('variety')");
    expect(detail).toContain("t('currentStock')");
    expect(detail).toContain('<VerifiedBadge');
    expect(detail).toContain('showTier');
    expect(detail).toContain('{product.variety}');
    expect(detail).toContain('{product.currentStock}');

    const catalog = source('app/[locale]/catalog/page.tsx');
    expect(catalog).toContain('<VerifiedBadge');
    expect(catalog).toContain('<QualityScoreChip');
    expect(catalog).toContain('showTier');
    expect(catalog).toContain("t('availableQuantity')");
  });

  it('does not translate seller-entered product fields', () => {
    const detail = source('app/[locale]/products/[id]/page.tsx');
    expect(detail).toContain('{product.variety}');
    expect(detail).not.toContain('localizeProductTitle(product.variety');
    expect(detail).toContain('formatProductTitle(product.title, locale)');
    expect(detail).toContain('formatProductDescription(product.description, locale)');
  });

  it('keeps product-image honesty and marketplace CTA placement from #143/#144', () => {
    const catalog = source('app/[locale]/catalog/page.tsx');
    expect(catalog).toContain('ProductPhotoPlaceholder');
    expect(catalog).toContain('getProductCardImage');
    expect(catalog.indexOf('<CatalogFilters')).toBeLessThan(catalog.indexOf('<CatalogPurchaseCta'));
    expect(catalog.indexOf('<CatalogPurchaseCta')).toBeLessThan(catalog.indexOf('</main>'));

    const requests = source('app/[locale]/requests/page.tsx');
    expect(requests.indexOf('<PurchaseRequestFilters')).toBeLessThan(
      requests.indexOf('<RequestsSellCta'),
    );
  });
});
