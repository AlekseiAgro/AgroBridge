import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web');
const MESSAGES_DIR = join(WEB, 'messages');
const CONTENT_DIR = join(WEB, 'src/content/legal');
const DEVELOPER_MARKER = '[FINAL LEGAL TEXT TO BE INSERTED IN PR #133]';

function readWeb(path: string) {
  return readFileSync(join(WEB, 'src', path), 'utf8');
}

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    footer: Record<string, string>;
    auth: Record<string, string>;
    cabinet: Record<string, string>;
    legal: Record<string, string>;
  };
}

describe('legal foundation UI architecture', () => {
  it('keeps legal document bodies only for ka and en', () => {
    expect(existsSync(join(CONTENT_DIR, 'information.ka.ts'))).toBe(true);
    expect(existsSync(join(CONTENT_DIR, 'information.en.ts'))).toBe(true);
    expect(existsSync(join(CONTENT_DIR, 'terms.ka.ts'))).toBe(true);
    expect(existsSync(join(CONTENT_DIR, 'terms.en.ts'))).toBe(true);
    expect(existsSync(join(CONTENT_DIR, 'privacy.ka.ts'))).toBe(true);
    expect(existsSync(join(CONTENT_DIR, 'privacy.en.ts'))).toBe(true);

    const extras = readdirSync(CONTENT_DIR).filter((name) =>
      /\.(ru|de|fr|it|es)\.ts$/.test(name),
    );
    expect(extras).toEqual([]);
  });

  it('shows public legal documents with a language switch and no missing-locale warning', () => {
    expect(existsSync(join(WEB, 'src/app/[locale]/legal/page.tsx'))).toBe(true);
    expect(existsSync(join(WEB, 'src/app/[locale]/terms/page.tsx'))).toBe(true);
    expect(existsSync(join(WEB, 'src/app/[locale]/privacy/page.tsx'))).toBe(true);

    const page = readWeb('components/LegalPublicPage.tsx');
    const panel = readWeb('components/LegalDocumentPanel.tsx');
    const switcher = readWeb('components/LegalLanguageSwitch.tsx');
    expect(page).toContain('LegalDocumentPanel');
    expect(page).not.toContain('LegalLocaleChooser');
    expect(panel).toContain('LegalLanguageSwitch');
    expect(switcher).toContain('ქართული');
    expect(switcher).toContain('English');
    expect(switcher).not.toContain('availableLocalesBody');
    expect(page).not.toContain('detectMessageLocale');
  });

  it('does not expose developer placeholder banners in the legal UI', () => {
    const uiFiles = [
      'components/LegalPublicPage.tsx',
      'components/LegalDocumentPanel.tsx',
      'components/LegalDocumentArticle.tsx',
      'components/LegalDocumentDialog.tsx',
      'components/AuthForm.tsx',
    ];
    for (const path of uiFiles) {
      expect(readWeb(path)).not.toContain(DEVELOPER_MARKER);
    }
    for (const locale of LOCALES) {
      expect(JSON.stringify(loadMessages(locale).legal)).not.toContain(DEVELOPER_MARKER);
      expect(JSON.stringify(loadMessages(locale).legal)).not.toMatch(
        /only (georgian|english)|не создаёт юридический перевод|keine rechtliche Übersetzung/i,
      );
    }

    const termsEn = readWeb('content/legal/terms.en.ts');
    const privacyEn = readWeb('content/legal/privacy.en.ts');
    expect(termsEn).not.toMatch(/shall be governed|binding arbitration|liability shall not exceed|refunds are/i);
    expect(privacyEn).not.toMatch(/we retain personal data for|our processors are|this cookie policy|standard contractual clauses/i);
  });

  it('adds footer legal links without a cabinet Legal sidebar item', () => {
    const footer = readWeb('components/SiteFooter.tsx');
    const shell = readWeb('components/CabinetShell.tsx');

    expect(footer).toContain('href="/legal"');
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain('href="/privacy"');
    expect(shell).toContain("href=\"/account/settings\"");
    expect(shell).not.toContain('href="/legal"');
    expect(shell).not.toContain('href="/terms"');
  });

  it('requires an explicit Terms checkbox on registration and opens legal documents in a modal', () => {
    const form = readWeb('components/AuthForm.tsx');
    expect(form).toContain('name="acceptTerms"');
    expect(form).toContain('type="checkbox"');
    expect(form).toContain('acceptTerms');
    expect(form).toContain('acceptedTermsVersion');
    expect(form).not.toContain('name="acceptPrivacy"');
    expect(form).toContain('privacyNotice');
    expect(form).toContain('LegalDocumentDialog');
    expect(form).not.toContain('href="/terms"');
    expect(form).not.toContain('href="/privacy"');

    const registerPage = readWeb('app/[locale]/register/page.tsx');
    expect(registerPage).toContain('currentDocumentOfType');
    expect(registerPage).not.toContain('.find(');
  });

  it('shows Terms acceptance state in Account Settings without claiming Privacy was accepted', () => {
    const settings = readWeb('app/[locale]/account/settings/page.tsx');
    expect(settings).toContain('cabinet-legal');
    expect(settings).toContain('/legal/me');
    expect(settings).toContain('termsAcceptedAt');
    expect(settings).toContain('termsNotAccepted');
    expect(settings).toContain('privacyNotAccepted');
    expect(settings).toContain('privacyTransparency');
    expect(settings).not.toContain('privacyAcceptedAt');
  });

  it('localizes legal UI chrome in every application locale without adding legal body translations', () => {
    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      expect(messages.footer.legalInformation.trim().length).toBeGreaterThan(0);
      expect(messages.footer.terms.trim().length).toBeGreaterThan(0);
      expect(messages.footer.privacy.trim().length).toBeGreaterThan(0);
      expect(messages.auth.acceptTerms).toContain('<terms>');
      expect(messages.auth.privacyNotice).toMatch(/^<privacy>.+<\/privacy>$/);
      expect(messages.auth.privacyNotice).not.toMatch(/also|также|aussi|también|anche|können auch/i);
      expect(messages.cabinet.legalTitle.trim().length).toBeGreaterThan(0);
      expect(messages.legal.documentPending.trim().length).toBeGreaterThan(0);
      expect(messages.legal.close.trim().length).toBeGreaterThan(0);
      expect(messages.legal).not.toHaveProperty('availableLocalesBody');
      expect(messages.legal).not.toHaveProperty('placeholderBanner');
    }
  });

  it('keeps operator facts on the Legal Information pages and avoids unsupported claims', () => {
    const en = readWeb('content/legal/information.en.ts');
    const ka = readWeb('content/legal/information.ka.ts');
    expect(en).toContain('P/E VANO MEGVINETUKHUTSESI');
    expect(en).toContain('Adam Mitskevichi St. 29/5');
    expect(ka).toContain('01501157152');
    for (const source of [en, ka]) {
      expect(source).toContain('01501157152');
      expect(source).toContain('29/5');
      expect(source).toContain('Support@agrobridge.ge');
      expect(source).toContain('https://agrobridge.ge');
      expect(source).not.toMatch(/GDPR certified|KYC|payment provider license/i);
    }
  });
});
