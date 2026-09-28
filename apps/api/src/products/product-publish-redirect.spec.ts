import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');

function source(rel: string): string {
  return readFileSync(join(WEB, 'src', rel), 'utf8');
}

describe('publish redirects to My Products', () => {
  const form = source('components/ProductForm.tsx');
  const list = source('app/[locale]/dashboard/products/page.tsx');
  const shell = source('components/CabinetShell.tsx');
  const navigation = source('i18n/navigation.ts');
  const routing = source('i18n/routing.ts');

  it('uses the canonical My Products route after a successful publish response', () => {
    expect(shell).toContain('href="/dashboard/products"');
    expect(shell).toContain("t('myProducts')");
    expect(list).toContain("t('dashboardTitle')");
    expect(list).toContain("apiRequestAuthed<ProductSummary[]>('/products/mine')");

    const fetchIndex = form.indexOf('await fetch(');
    const okCheck = form.indexOf('if (!response.ok)');
    const publishPush = form.indexOf("intent === 'publish'");
    const pushIndex = form.indexOf("router.push('/dashboard/products')");

    expect(fetchIndex).toBeGreaterThan(-1);
    expect(okCheck).toBeGreaterThan(fetchIndex);
    expect(pushIndex).toBeGreaterThan(okCheck);
    expect(form.slice(okCheck, pushIndex)).toContain("intent === 'publish'");
    expect(publishPush).toBeGreaterThan(-1);
    expect(form).toContain("from '@/i18n/navigation'");
    expect(navigation).toContain('createNavigation');
    expect(routing).toContain("localePrefix: 'always'");
  });

  it('does not navigate when publication fails or when saving a draft', () => {
    const okCheck = form.indexOf('if (!response.ok)');
    const publishNav = form.indexOf("if (intent === 'publish')", okCheck);
    const failBlock = form.slice(okCheck, publishNav);
    expect(failBlock).toContain('setError');
    expect(failBlock).not.toContain('router.push');
    expect(failBlock).not.toContain('router.replace');

    expect(form).toContain("t('savedDraftHint')");
    expect(form).toContain('router.refresh()');
    expect(form.indexOf("t('savedDraftHint')")).toBeGreaterThan(
      form.indexOf("router.push('/dashboard/products')"),
    );
    const saveBlock = form.slice(form.indexOf("t('savedDraftHint')") - 80, form.indexOf('router.refresh()') + 20);
    expect(saveBlock).not.toContain('router.push');
    expect(form).not.toContain("router.push('/catalog");
    expect(form).not.toMatch(/router\.push\('\/dashboard'\)/);
    expect(form).not.toContain("router.push('/products/");
  });

  it('keeps required-field checks and blocks duplicate publish submits', () => {
    expect(form).toContain('listingRequirementIssues');
    expect(form.indexOf('listingRequirementIssues')).toBeLessThan(form.indexOf('await fetch('));
    expect(form).toContain('submitLock');
    expect(form).toContain('if (pending || submitLock.current)');
    expect(form).toMatch(/value="publish"[\s\S]{0,80}disabled=\{pending\}/);
    expect(form).toMatch(/value="save"[\s\S]{0,80}disabled=\{pending\}/);
  });
});
