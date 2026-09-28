import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');

function source(rel: string): string {
  return readFileSync(join(WEB, 'src', rel), 'utf8');
}

describe('Update availability focus', () => {
  const actions = source('components/MyProductCardActions.tsx');
  const form = source('components/ProductForm.tsx');
  const focus = source('components/HarvestAvailabilityFocus.tsx');
  const intent = source('lib/harvest-availability-focus.ts');
  const edit = source('app/[locale]/dashboard/products/[id]/edit/page.tsx');
  const catalog = source('app/[locale]/catalog/page.tsx');
  const css = source('app/globals.css');
  const harvest = readFileSync(join(__dirname, '../../../../packages/shared/src/harvest.ts'), 'utf8');

  it('sends Update availability to the existing edit route with a one-shot fragment', () => {
    expect(intent).toContain("export const HARVEST_STATUS_FOCUS_HASH = '#harvest-status'");
    expect(actions).toContain('const editHref = `/dashboard/products/${productId}/edit`');
    expect(actions).toContain('const availabilityHref = `${editHref}${HARVEST_STATUS_FOCUS_HASH}`');
    const primary = actions.slice(
      actions.indexOf('product-list__action--primary'),
      actions.indexOf('mine-card-menu'),
    );
    expect(primary).toContain('href={availabilityHref}');
    expect(primary).toContain("t('updateAvailability')");
    expect(primary).not.toContain('href={editHref}');
  });

  it('keeps Edit, catalog, and direct edit navigation free of the availability fragment', () => {
    const editLink = actions.slice(actions.indexOf('mine-card-menu__item'));
    expect(editLink).toContain('href={editHref}');
    expect(editLink).toContain("t('edit')");
    expect(editLink).not.toContain('availabilityHref');
    expect(editLink).not.toContain('#harvest-status');
    expect(catalog).not.toContain('HARVEST_STATUS_FOCUS_HASH');
    expect(catalog).not.toContain('#harvest-status');
    expect(edit).not.toContain('searchParams');
    expect(edit).not.toContain('#harvest-status');
    expect(edit).toContain('mode="edit"');
    expect(form).toContain('router.replace(`/dashboard/products/${data.id}/edit`)');
    expect(form).not.toContain('router.replace(`/dashboard/products/${data.id}/edit#');
  });

  it('targets the existing Harvest Planning section and Harvest Status control', () => {
    expect(intent).toContain("export const HARVEST_PLANNING_ID = 'harvest-planning'");
    expect(intent).toContain("export const HARVEST_STATUS_ID = 'harvest-status'");
    expect(form).toContain('id={HARVEST_PLANNING_ID}');
    expect(form).toContain('className="field-group harvest-form product-form__section"');
    expect(form).toContain("th('formTitle')");
    expect(form).toContain('id={HARVEST_STATUS_ID}');
    expect(form).toContain("th('statusLabel')");
    expect(form).toContain('{mode === \'edit\' ? <HarvestAvailabilityFocus /> : null}');
    expect(form.match(/id=\{HARVEST_PLANNING_ID\}/g)).toHaveLength(1);
    expect(form.match(/id=\{HARVEST_STATUS_ID\}/g)).toHaveLength(1);
    expect(css.match(/#harvest-planning/g)?.length).toBe(1);
    expect(focus).toContain('document.getElementById(HARVEST_STATUS_ID)');
    expect(focus).toContain("scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })");
    expect(css).toContain(`#harvest-planning,
#harvest-status {
  scroll-margin-top: 5rem;
  scroll-margin-bottom: 1.5rem;
}`);
  });

  it('applies a temporary highlight only for the availability fragment and then removes it', () => {
    expect(intent).toContain("export const HARVEST_STATUS_FOCUS_CLASS = 'harvest-status--focus'");
    expect(intent).toContain('export const HARVEST_STATUS_FOCUS_MS = 1600');
    expect(focus).toContain('if (window.location.hash !== HARVEST_STATUS_FOCUS_HASH)');
    expect(focus.indexOf('window.location.hash !== HARVEST_STATUS_FOCUS_HASH')).toBeLessThan(
      focus.indexOf('classList.add(HARVEST_STATUS_FOCUS_CLASS)'),
    );
    expect(focus).toContain('target.classList.add(HARVEST_STATUS_FOCUS_CLASS)');
    expect(focus).toContain('target.classList.remove(HARVEST_STATUS_FOCUS_CLASS)');
    expect(focus).toContain('window.setTimeout');
    expect(focus).toContain('HARVEST_STATUS_FOCUS_MS');
    expect(focus).toContain('window.clearTimeout(timeoutId)');
    expect(focus).not.toContain('localStorage');
    expect(focus).not.toContain('sessionStorage');
    expect(css).toContain('#harvest-status.harvest-status--focus');
    expect(css).not.toMatch(/harvest-status-pulse[^\{]*infinite/);
    expect(css).toContain('animation: harvest-status-pulse 1.4s ease;');
  });

  it('strips the fragment before the highlight ends so a refresh does not replay it', () => {
    const addClass = focus.indexOf('target.classList.add(HARVEST_STATUS_FOCUS_CLASS)');
    const replaceState = focus.indexOf('window.history.replaceState');
    expect(replaceState).toBeGreaterThan(-1);
    expect(replaceState).toBeLessThan(addClass);
    expect(focus).toContain('const nextUrl = `${window.location.pathname}${window.location.search}`');
    expect(focus).toContain('window.history.replaceState(window.history.state, \'\', nextUrl)');
    expect(focus).not.toContain('localStorage');
  });

  it('respects reduced motion with a static highlight and keeps the control accessible', () => {
    const animationRule = css.indexOf('animation: harvest-status-pulse 1.4s ease;');
    const motionQuery = css.lastIndexOf('@media (prefers-reduced-motion: no-preference)', animationRule);
    expect(motionQuery).toBeGreaterThan(-1);
    expect(css.slice(motionQuery, animationRule)).toContain('#harvest-status.harvest-status--focus');
    const staticRule = css.indexOf('#harvest-status.harvest-status--focus {');
    expect(staticRule).toBeGreaterThan(-1);
    expect(staticRule).toBeLessThan(motionQuery);
    expect(css.slice(staticRule, motionQuery)).toContain('outline: 2px solid var(--brand)');
    expect(focus).toContain('target.focus({ preventScroll: true })');
    expect(focus).not.toContain('tabIndex={-1}');
    expect(form).toContain('value={harvestStatus}');
  });

  it('leaves save, publish, and harvest status values unchanged', () => {
    expect(harvest).toContain("export const HARVEST_STATUSES = [");
    expect(harvest).toContain("'growing'");
    expect(harvest).toContain("'available'");
    expect(harvest).toContain("'limited'");
    expect(harvest).toContain("'soldOut'");
    expect(form).toContain('HARVEST_STATUSES.map((status) => (');
    expect(form).toContain('value="save"');
    expect(form).toContain('value="publish"');
    expect(form).toContain("router.push('/dashboard/products')");
    expect(form).toContain('router.refresh()');
    expect(form).toContain("harvestStatus: harvestStatus || null");
    expect(actions).toContain("JSON.stringify({ harvestStatus: 'soldOut' })");
    expect(actions).toContain("method: 'PATCH'");
    expect(actions).not.toContain("method: 'POST'");
    expect(focus).not.toContain('harvestStatus');
    expect(focus).not.toContain('fetch(');
  });
});
