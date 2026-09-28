import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

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

describe('sold-out product blocks new RFQs', () => {
  const page = source('app/[locale]/products/[id]/page.tsx');
  const watch = source('components/HarvestWatchButton.tsx');
  const service = readFileSync(join(__dirname, 'rfqs.service.ts'), 'utf8');
  const serviceSpec = readFileSync(join(__dirname, 'rfqs.service.spec.ts'), 'utf8');
  const products = readFileSync(join(__dirname, '../products/products.service.ts'), 'utf8');

  it('does not render the quote form when the harvest is sold out', () => {
    expect(page).toContain("const soldOut = product.harvestStatus === 'soldOut'");
    expect(page).toContain('{soldOut ? null : canRequest ? (');
    expect(page).toContain('<RfqRequestForm');
    expect(page.indexOf('{soldOut ? null : canRequest ? (')).toBeLessThan(
      page.indexOf('<RfqRequestForm'),
    );
    expect(page).toContain('href="#request-quote"');
    expect(page).toContain("th('soldOutTitle')");
    expect(page).toContain('unavailable={soldOut}');
    expect(page).toContain('href="#harvest-alerts"');
    expect(page).toContain("th('notifyWhenAvailable')");
  });

  it('reuses HarvestWatch for the sold-out notify action, including subscribed and owner states', () => {
    expect(page).toContain('<HarvestWatchButton');
    expect(page).toContain('initialWatching={Boolean(product.watching)}');
    expect(watch).toContain("t('notifyWhenAvailable')");
    expect(watch).toContain("t('soldOutWatching')");
    expect(watch).toContain("t('soldOutLogin')");
    expect(watch).toContain("t('ownerWatchHint')");
    expect(watch).toContain('if (isOwner)');
    expect(watch).toContain("fetch(`/api/products/${productId}/watch`");
    expect(watch).toContain("method: watching ? 'DELETE' : 'POST'");
    expect(watch).toContain('loginRedirectHref(`/products/${productId}#harvest-alerts`)');
  });

  it('rejects sold-out RFQ creation in the service, not only in the page', () => {
    expect(service).toContain("product.harvestStatus === 'soldOut'");
    expect(service).toContain('This product is currently unavailable');
    expect(service).toContain('You cannot request a quote for your own product');
    expect(serviceSpec).toContain("it('rejects a direct RFQ create when the product is sold out'");
    expect(serviceSpec).toContain("it.each(['available', 'limited']");
    const watchProduct = products.slice(
      products.indexOf('async watchProduct'),
      products.indexOf('async unwatchProduct'),
    );
    expect(watchProduct).toContain('You cannot watch your own product');
    expect(watchProduct).not.toContain('soldOut');
    expect(products).toContain('notifyHarvestAvailable');
  });
});

describe('sold-out product copy', () => {
  const KEYS = [
    'harvest.soldOutTitle',
    'harvest.soldOutSubtitle',
    'harvest.notifyWhenAvailable',
    'harvest.soldOutWatching',
    'harvest.soldOutLogin',
    'harvest.ownerWatchHint',
  ] as const;

  it('keeps English as the canonical sold-out copy', () => {
    const en = messages('en');
    expect(read(en, 'harvest.soldOutTitle')).toBe('Currently unavailable');
    expect(read(en, 'harvest.notifyWhenAvailable')).toBe('Notify me when available');
    expect(read(en, 'harvest.soldOutWatching')).toBe("✓ You'll be notified when available");
  });

  it.each(LOCALES)('%s has sold-out harvest keys', (locale) => {
    const data = messages(locale);
    for (const key of KEYS) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
  });
});
