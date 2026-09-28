import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web/src');

function source(name: string): string {
  return readFileSync(join(WEB, name), 'utf8');
}

describe('Add Product creates a record only on explicit save', () => {
  const page = source('app/[locale]/dashboard/products/new/page.tsx');
  const form = source('components/ProductForm.tsx');
  const edit = source('app/[locale]/dashboard/products/[id]/edit/page.tsx');

  it('opens an empty form and does not create a product on the page', () => {
    expect(page).toContain('<ProductForm mode="create" />');
    expect(page).not.toContain('apiRequestAuthed');
    expect(page).not.toContain("method: 'POST'");
    expect(page).not.toContain('draftTitle');
    expect(page).not.toContain('/dashboard/products/${');
    expect(page).not.toContain('useEffect');
  });

  it('creates the product only from the save submit handler', () => {
    expect(form).toContain("if (pending || submitLock.current)");
    expect(form).toContain('submitLock.current = true');
    expect(form).toContain("mode === 'create' ? '/api/products' : `/api/products/${initial?.id}`");
    expect(form).toContain("method: mode === 'create' ? 'POST' : 'PATCH'");
    expect(form).toContain('let created = false');
    expect(form).toContain('created = true');
    expect(form).toContain('if (!created)');
    expect(form).toContain('router.replace(`/dashboard/products/${data.id}/edit`)');
    expect(form).not.toContain('useEffect');
    const posts = form.match(/method: mode === 'create' \? 'POST'/g) ?? [];
    expect(posts).toHaveLength(1);
  });

  it('keeps the existing edit page on PATCH with media after the product exists', () => {
    expect(edit).toContain('mode="edit"');
    expect(edit).toContain('apiRequestAuthed<ProductDetail>(`/products/${id}`)');
    expect(edit).toContain('ProductImagesManager');
    expect(edit).toContain('ProductVideosManager');
    expect(edit).toContain('ProductCertificatesManager');
    expect(edit).not.toContain("method: 'POST'");
    expect(form).toContain("method: mode === 'create' ? 'POST' : 'PATCH'");
  });
});
