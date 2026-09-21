import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web/src');
const API = join(__dirname, '..');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

function readApi(path: string) {
  return readFileSync(join(API, path), 'utf8');
}

describe('product owner RFQ UI', () => {
  const page = readWeb('app/[locale]/products/[id]/page.tsx');
  const form = readWeb('components/RfqRequestForm.tsx');
  const service = readApi('rfqs/rfqs.service.ts');
  const serviceSpec = readApi('rfqs/rfqs.service.spec.ts');

  it('keeps the unauthenticated login CTA and does not show the form', () => {
    expect(page).toContain("tr('loginToRequest')");
    expect(page).toContain("href={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`}");
    expect(page).toMatch(/canRequest \? \([\s\S]*<RfqRequestForm[\s\S]*\) : !user \?/);
    expect(page).toContain('className="product-login-cta product-request-anchor"');
  });

  it('shows the RFQ form only for an authenticated non-owner', () => {
    expect(page).toContain('const canRequest = Boolean(user) && !product.isOwner');
    expect(page).toContain('<RfqRequestForm');
    expect(page).toContain('productId={product.id}');
    expect(form).toContain("fetch('/api/rfqs'");
  });

  it('hides the RFQ header CTA and form from the product owner', () => {
    expect(page).toContain('{!product.isOwner ? (');
    expect(page).toContain('href="#request-quote"');
    expect(page.indexOf('{!product.isOwner ? (')).toBeLessThan(page.indexOf('href="#request-quote"'));
    expect(page).toContain('const canRequest = Boolean(user) && !product.isOwner');
    expect(page).not.toContain('const canRequest = Boolean(user);');
  });

  it('keeps existing owner-only product chrome', () => {
    expect(page).toContain('{product.isOwner ? (');
    expect(page).toContain('<ProductQualityWidget');
    expect(page).toContain('isOwner={Boolean(product.isOwner)}');
    expect(page).toContain('<HarvestWatchButton');
  });

  it('does not weaken backend self-RFQ rejection', () => {
    expect(service).toContain('product.ownerUserId === user.id');
    expect(service).toContain('You cannot request a quote for your own product');
    expect(serviceSpec).toContain("it('rejects RFQ for own product'");
  });
});
