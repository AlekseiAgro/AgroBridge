import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');

function source(rel: string): string {
  return readFileSync(join(WEB, 'src', rel), 'utf8');
}

/** Each `if (intent === 'publish')` success branch, in source order. */
function publishSuccessBlocks(form: string): string[] {
  const marker = "if (intent === 'publish') {";
  const blocks: string[] = [];
  let from = 0;
  while (from < form.length) {
    const start = form.indexOf(marker, from);
    if (start < 0) break;
    const next = form.indexOf(marker, start + marker.length);
    const catchAt = form.indexOf('} catch {', start);
    const end = next > start ? next : catchAt;
    blocks.push(form.slice(start, end < 0 ? form.length : end));
    from = start + marker.length;
  }
  return blocks;
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

    const [createSuccess, editSuccess] = publishSuccessBlocks(form);
    expect(createSuccess).toBeDefined();
    expect(editSuccess).toBeDefined();

    expect(createSuccess).toContain("router.push('/dashboard/products')");
    const createSave = createSuccess.slice(createSuccess.indexOf('} else {'));
    expect(createSave).toContain('router.replace(`/dashboard/products/${data.id}/edit`)');
    expect(createSave).not.toContain("router.push('/dashboard/products')");

    const publishPush = editSuccess.indexOf("router.push('/dashboard/products')");
    const publishReturn = editSuccess.indexOf('return;', publishPush);
    const saveStart = editSuccess.indexOf("setSuccess(t('savedDraftHint'))", publishReturn);
    const saveRefresh = editSuccess.indexOf('router.refresh()', saveStart);
    expect(publishPush).toBeGreaterThan(-1);
    expect(publishReturn).toBeGreaterThan(publishPush);
    expect(saveStart).toBeGreaterThan(publishReturn);
    expect(saveRefresh).toBeGreaterThan(saveStart);

    const saveBlock = editSuccess.slice(publishReturn + 'return;'.length, saveRefresh);
    expect(saveBlock).toContain("setSuccess(t('savedDraftHint'))");
    expect(saveBlock).not.toContain('router.push');
    expect(saveBlock).not.toContain('router.replace');
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
