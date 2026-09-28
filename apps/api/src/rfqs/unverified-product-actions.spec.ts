import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

type Nested = Record<string, unknown>;

function source(name: string): string {
  return readFileSync(join(WEB, 'src', name), 'utf8');
}

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

describe('unverified buyers on a public product', () => {
  const page = source('app/[locale]/products/[id]/page.tsx');
  const watch = source('components/HarvestWatchButton.tsx');
  const chat = source('components/OpenChatButton.tsx');
  const form = source('components/RfqRequestForm.tsx');
  const guard = readFileSync(join(__dirname, '../auth/email-verified.guard.ts'), 'utf8');

  it('sends RFQ, chat, and harvest watch through the existing verify-email next flow', () => {
    expect(page).toContain('const needsEmailVerification = Boolean(user && !user.emailVerified)');
    expect(page).toContain('const canRequest = Boolean(user?.emailVerified) && !product.isOwner');
    expect(page).toContain('verifyEmailRedirectHref(productPath)');
    expect(page).toContain('verifyEmailRedirectHref(`${productPath}#request-quote`)');
    expect(page).toContain('verifyEmailRedirectHref(`${productPath}#harvest-alerts`)');
    expect(page).toContain('href={verifyRequestHref}');
    expect(page).toContain('href={verifyProductHref}');
    expect(page).toContain('href={verifyWatchHref}');
    expect(page).toContain('verifyHref={needsEmailVerification ? verifyWatchHref : undefined}');

    const requestGate = page.slice(
      page.indexOf('needsEmailVerification && !product.isOwner'),
      page.indexOf(': !user ?'),
    );
    expect(requestGate).toContain('verifyRequestHref');
    expect(requestGate).not.toContain('RfqRequestForm');
    expect(requestGate).not.toContain("fetch(");

    const chatGate = page.slice(
      page.indexOf('{needsEmailVerification ? ('),
      page.indexOf('<OpenChatButton'),
    );
    expect(chatGate).toContain('verifyProductHref');
    expect(chatGate).not.toContain("fetch(");
    expect(chatGate).not.toContain('<OpenChatButton');
  });

  it('does not call the trade APIs before email verification', () => {
    expect(watch.indexOf('if (!isLoggedIn)')).toBeLessThan(watch.indexOf('if (isOwner)'));
    expect(watch.indexOf('if (isOwner)')).toBeLessThan(watch.indexOf('if (verifyHref)'));
    const verifyBranch = watch.slice(watch.indexOf('if (verifyHref)'), watch.indexOf('async function toggle'));
    expect(verifyBranch).toContain('href={verifyHref}');
    expect(verifyBranch).not.toContain('fetch(');
    expect(watch).toContain("fetch(`/api/products/${productId}/watch`");
    expect(form).toContain("fetch('/api/rfqs'");
    expect(chat).toContain("fetch('/api/conversations'");
    expect(guard).toContain(
      "throw new ForbiddenException('Confirm your email address to access your account')",
    );
  });

  it('keeps guests, owners, verified buyers, and sold-out RFQ rules', () => {
    expect(page).toContain("href={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`}");
    expect(page).toContain("tr('loginToRequest')");
    expect(watch).toContain('loginRedirectHref(`/products/${productId}#harvest-alerts`)');
    expect(watch).toContain("t('soldOutLogin')");
    expect(watch).toContain("t('ownerWatchHint')");
    expect(page).toContain('{!product.isOwner ? (');
    expect(page).toContain('isOwner={Boolean(product.isOwner)}');
    expect(page).toContain('{soldOut ? null : canRequest ? (');
    expect(page).toContain('<RfqRequestForm');
    expect(page).toContain('href="#request-quote"');
    expect(page).toContain('href="#harvest-alerts"');
    expect(page).toContain("th('notifyWhenAvailable')");
    expect(page).toContain('unavailable={soldOut}');
    expect(page).toContain('<OpenChatButton');
  });
});

describe('product verification gate copy', () => {
  it.each(LOCALES)('%s explains that email confirmation continues the product', (locale) => {
    const copy = read(messages(locale), 'verifyEmail.productGate');
    expect(copy.trim().length).toBeGreaterThan(10);
    expect(copy.toLowerCase()).not.toContain('котиров');
    expect(read(messages(locale), 'verifyEmail.confirm').trim().length).toBeGreaterThan(0);
  });

  it('keeps Russian offer wording', () => {
    const ru = messages('ru');
    expect(read(ru, 'verifyEmail.productGate')).toBe(
      'Подтвердите email, чтобы продолжить с этим товаром.',
    );
    expect(read(ru, 'rfq.loginToRequest')).toBe('Войдите, чтобы запросить предложение');
    expect(read(ru, 'nav.myQuotes')).toBe('Мои предложения');
    expect(JSON.stringify(ru).toLowerCase()).not.toContain('котиров');
  });
});
