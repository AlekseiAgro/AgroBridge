import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['ka', 'en', 'ru', 'de', 'fr', 'it', 'es'] as const;
const NOTICE_KEY = 'descriptionContactNotice';
const EN_NOTICE =
  "Do not include personal or contact information in the description, such as phone numbers, email addresses, physical addresses, or links to personal profiles. Use the platform's built-in communication tools to contact other users.";

function productMessages(locale: string): Record<string, unknown> {
  const json = JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as {
    product: Record<string, unknown>;
  };
  return json.product;
}

describe('product description contact notice', () => {
  const form = readFileSync(join(WEB, 'src/components/ProductForm.tsx'), 'utf8');
  const newPage = readFileSync(
    join(WEB, 'src/app/[locale]/dashboard/products/new/page.tsx'),
    'utf8',
  );
  const editPage = readFileSync(
    join(WEB, 'src/app/[locale]/dashboard/products/[id]/edit/page.tsx'),
    'utf8',
  );

  it('is rendered by the shared form used on both the create and edit pages', () => {
    expect(newPage).toContain('<ProductForm');
    expect(editPage).toContain('<ProductForm');
    expect(form).toContain(`t('${NOTICE_KEY}')`);
  });

  it('sits directly below the description field and before the photos and videos', () => {
    const textarea = form.indexOf('value={description}');
    const notice = form.indexOf(`t('${NOTICE_KEY}')`);
    const between = form.slice(textarea, notice);
    expect(textarea).toBeGreaterThan(-1);
    expect(between).toContain('</label>');
    expect(between).not.toMatch(/<label|<input|<select|<textarea|<fieldset/);
    expect(notice).toBeLessThan(form.indexOf('<ProductStagedMedia'));
    expect(notice).toBeLessThan(form.indexOf('{media}'));
  });

  it('uses the secondary hint style and is linked to the textarea', () => {
    expect(form).toContain('aria-describedby={descriptionNoticeId}');
    expect(form).toMatch(
      /<p className="field-hint" id=\{descriptionNoticeId\}>\s*\{t\('descriptionContactNotice'\)\}/,
    );
    expect(form).not.toMatch(/form-error"[^>]*>\s*\{t\('descriptionContactNotice'\)\}/);
  });

  it('does not validate or block the description text', () => {
    expect(form).not.toMatch(/containsPhoneLikeNumber|findPhoneLikeNumbers|redactPhoneLikeNumbers/);
    expect(form).toContain('description: description.trim(),');
  });

  it('uses the approved English text', () => {
    expect(productMessages('en')[NOTICE_KEY]).toBe(EN_NOTICE);
  });

  it.each(LOCALES.filter((locale) => locale !== 'en'))('%s has its own translation', (locale) => {
    const notice = productMessages(locale)[NOTICE_KEY];
    expect(typeof notice).toBe('string');
    expect((notice as string).trim().length).toBeGreaterThan(40);
    expect(notice).not.toBe(EN_NOTICE);
  });
});
