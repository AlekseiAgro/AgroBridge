import { readFileSync } from 'fs';
import { join } from 'path';
import { formatListedPrice } from '@agrobridge/shared';

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

describe('My Products availability card', () => {
  const page = source('app/[locale]/dashboard/products/page.tsx');
  const actions = source('components/MyProductCardActions.tsx');
  const quantity = source('lib/product-quantity.ts');
  const css = source('app/globals.css');

  it('renders harvest status, stock, listed price, and moderation on the card', () => {
    expect(page).toContain('HarvestStatusBadge');
    expect(page).toContain('product.harvestStatus');
    expect(page).toContain('preorderEnabled={product.preorderEnabled}');
    expect(page).toContain('formatCurrentStock(product)');
    expect(page).toContain('formatListedPrice(product)');
    expect(page).toContain("t(`moderation.${product.moderationStatus}`)");
    expect(page).toContain('product-list__availability');
    expect(page).toContain('product-list__stock');
    expect(quantity).toContain('export function formatCurrentStock');
    expect(formatListedPrice({ priceFrom: 4.5, priceCurrency: 'EUR', unit: 'kg' })).toBe(
      '€ 4.50 / kg',
    );
  });

  it('opens product preview from the title and the main image', () => {
    expect(page).toContain('const previewHref = `/products/${product.id}`');
    expect(page).toContain('className="product-list__media-link"');
    expect(page).toContain('aria-label={t(\'preview\')}');
    expect(page).toContain('className="product-list__title"');
    expect(page.indexOf('product-list__media-link')).toBeLessThan(
      page.indexOf('className="product-list__title"'),
    );
    expect(page).not.toMatch(/<Link[\s\S]*product-list__action--primary[\s\S]*t\('preview'\)/);
  });

  it('keeps Update availability as the primary action into the existing editor', () => {
    expect(page).toContain('MyProductCardActions');
    expect(actions).toContain("t('updateAvailability')");
    expect(actions).toContain("className=\"button button--primary product-list__action--primary\"");
    expect(actions).toContain('`/dashboard/products/${productId}/edit`');
    expect(actions).toContain("harvestStatus !== 'soldOut'");
  });

  it('puts Edit, Mark as out of stock, and Delete in an overflow menu', () => {
    expect(actions).toContain('mine-card-menu');
    expect(actions).toContain("t('moreActions')");
    expect(actions).toContain("t('edit')");
    expect(actions).toContain("t('markSoldOut')");
    expect(actions).toContain('DeleteProductButton');
    expect(actions).toContain("harvestStatus !== 'soldOut'");
    expect(css).toContain('.mine-card-menu__panel');
    expect(css).toContain('.mine-card-menu__item--danger');
  });

  it('marks the current harvest soldOut through the existing PATCH product endpoint', () => {
    expect(actions).toContain("method: 'PATCH'");
    expect(actions).toContain('`/api/products/${productId}`');
    expect(actions).toContain("JSON.stringify({ harvestStatus: 'soldOut' })");
    expect(actions).toContain("t('markSoldOutConfirm')");
    expect(actions).toContain('window.confirm');
    expect(actions).not.toContain('currentStock');
    expect(actions).not.toContain("method: 'POST'");
    expect(actions).not.toContain('/watch');
    expect(actions).not.toContain('notifyHarvestAvailable');
    expect(actions).not.toContain('Notify me');
  });

  it('does not add RFQ blocking, harvest subscription UI, or a new endpoint', () => {
    expect(page).not.toContain('rfq');
    expect(page).not.toContain('HarvestWatch');
    expect(page).not.toContain('watchProduct');
    expect(actions).not.toContain('purchase-requests');
    expect(actions).not.toContain('blocked');
    expect(source('app/api/products/[id]/route.ts')).toContain('method: \'PATCH\'');
  });
});

describe('My Products availability locales', () => {
  const KEYS = [
    'product.updateAvailability',
    'product.moreActions',
    'product.markSoldOut',
    'product.markSoldOutConfirm',
  ] as const;

  it('keeps English as the canonical source', () => {
    const en = messages('en');
    expect(read(en, 'product.updateAvailability')).toBe('Update availability');
    expect(read(en, 'product.markSoldOut')).toBe('Mark as out of stock');
    expect(read(en, 'harvest.status.soldOut')).toBe('Sold out');
  });

  it.each(LOCALES)('%s has My Products availability action keys', (locale) => {
    const data = messages(locale);
    for (const key of KEYS) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
  });
});
