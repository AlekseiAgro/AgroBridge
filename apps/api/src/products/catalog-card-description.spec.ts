import { readFileSync } from 'fs';
import { join } from 'path';

const WEB_SRC = join(__dirname, '../../../web/src');

function source(path: string): string {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

function catalogCard(): string {
  const page = source('app/[locale]/catalog/page.tsx');
  const start = page.indexOf('{products.map((product) => {');
  const end = page.indexOf('</ul>', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return page.slice(start, end);
}

describe('general catalog product cards', () => {
  it('do not render the product description, an excerpt, or a placeholder for it', () => {
    const page = source('app/[locale]/catalog/page.tsx');
    expect(page).not.toContain('catalogDisplayDescription');
    expect(page).not.toMatch(/\.description\b/);
    expect(page).not.toContain('product-list__desc');

    const card = catalogCard();
    expect(card).not.toMatch(/description|excerpt|line-clamp|lineClamp|truncate/i);
  });

  it('keep every other card field and link', () => {
    const card = catalogCard();
    for (const fragment of [
      'getProductCardImage',
      'className="product-list__media"',
      '<ProductPhotoPlaceholder',
      'href={`/products/${product.id}`} className="product-list__title"',
      'catalogDisplayTitle(product)',
      '<CardOriginalTitle',
      '<FarmLink',
      'product.country',
      '<VerifiedBadge',
      "t(`categories.${product.category as 'fruits'}`)",
      '<HarvestStatusBadge',
      'preorderEnabled={product.preorderEnabled}',
      "listedPrice ?? t('priceOnRequest')",
      '<MarketOpportunityBadge',
      '<QualityScoreChip score={product.qualityScore} showTier />',
      '<CertificateBadges',
      "t('sellerRating')",
      'reviewsHref={`/users/${product.owner.id}/reviews`}',
      "t('availableQuantity')",
    ]) {
      expect(card).toContain(fragment);
    }
  });

  it('keep the full description on the product detail page', () => {
    const detail = source('app/[locale]/products/[id]/page.tsx');
    expect(detail).toContain('{catalogDisplayDescription(product) || product.description ? (');
    expect(detail).toContain('<h2 className="section-title">{t(\'description\')}</h2>');
    expect(detail).toContain('display={catalogDisplayDescription(product)}');
    expect(detail).toContain('source={product.source?.description ?? product.description}');
    expect(detail).not.toMatch(/description[^\n]*\.(slice|substring)\(/);
  });

  it('keep the description field in the product form', () => {
    const form = source('components/ProductForm.tsx');
    expect(form).toContain("t('description')");
    expect(form).toContain('value={description}');
  });
});
