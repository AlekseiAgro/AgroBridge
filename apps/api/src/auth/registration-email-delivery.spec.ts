import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

type Nested = Record<string, unknown>;

function source(rel: string): string {
  return readFileSync(join(WEB, 'src', rel), 'utf8');
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

describe('initial verification email delivery UX', () => {
  const registerRoute = source('app/api/auth/register/route.ts');
  const loginRoute = source('app/api/auth/login/route.ts');
  const form = source('components/AuthForm.tsx');
  const page = source('app/[locale]/verify-email/page.tsx');
  const verifyForm = source('components/VerifyEmailForm.tsx');
  const authService = readFileSync(join(__dirname, 'auth.service.ts'), 'utf8');
  const verification = readFileSync(
    join(__dirname, '../verification/verification.service.ts'),
    'utf8',
  );

  it('forwards only a boolean when registration could not send the first email', () => {
    expect(registerRoute).toContain('verificationEmailSent: result.verificationEmailSent !== false');
    expect(registerRoute).not.toContain('error.stack');
    expect(registerRoute).not.toContain('SMTP');
    expect(loginRoute).not.toContain('verificationEmailSent');

    expect(form).toContain("mode === 'register' && data.verificationEmailSent === false");
    expect(form).toContain("verifyParams.set('verificationEmail', 'unsent')");
    expect(form).toContain('`/verify-email?${verifyParams.toString()}`');
    const destination = form.slice(form.indexOf('const verifyParams'), form.indexOf('router.replace'));
    expect(destination).not.toContain('SMTP');
  });

  it('shows a localized notice on the existing verification page and keeps resend', () => {
    expect(page).toContain("verificationEmail === 'unsent'");
    expect(page).toContain('initialEmailUnsent={verificationEmail === \'unsent\'}');
    expect(page).toContain('safeNextPath(next, \'/account\')');
    expect(verifyForm).toContain("initialEmailUnsent ? t('initialSendFailed') : null");
    expect(verifyForm).toContain("postJson<{ destination: string }>('/api/verification/email/send-code')");
    expect(verifyForm).toContain("setMessage(t('sent', { destination: result.destination }))");
    expect(verifyForm).toContain("postJson('/api/verification/email/confirm', { code })");
    expect(verifyForm).toContain("t('resend')");
    expect(verifyForm).not.toContain('smtp');
    expect(verifyForm).not.toContain('/api/auth/register');
  });

  it('does not roll back registration, leak mail errors, or send the welcome email early', () => {
    const register = authService.slice(
      authService.indexOf('async register'),
      authService.indexOf('async login'),
    );
    expect(register).toContain('await this.verification.sendEmailCode(authUser, ip)');
    expect(register).not.toContain('void this.verification.sendEmailCode');
    expect(register).not.toContain('user.delete');
    expect(register).not.toContain('notifyWelcome');
    expect(register).toContain('verificationEmailSent');
    expect(register).toContain("throw new ConflictException('Email is already registered')");
    expect(register.indexOf("throw new ConflictException('Email is already registered')")).toBeLessThan(
      register.indexOf('await this.verification.sendEmailCode'),
    );

    const confirm = verification.slice(
      verification.indexOf('async confirmEmailCode'),
      verification.indexOf('async sendSmsCode'),
    );
    expect(confirm).toContain('notifyWelcome');
    expect(confirm).toContain('.catch(() => undefined)');
    const send = verification.slice(
      verification.indexOf('async sendEmailCode'),
      verification.indexOf('async confirmEmailCode'),
    );
    expect(send).toContain('this.codes.issue');
    expect(send).toContain('ServiceUnavailableException');
    expect(send).not.toContain('verificationEmailSent');
  });

  it('keeps the Russian notice calm and free of provider details', () => {
    const ru = read(messages('ru'), 'verifyEmail.initialSendFailed');
    expect(ru).toBe(
      'Не удалось отправить письмо с кодом подтверждения. Вы можете попробовать отправить код ещё раз.',
    );
    expect(ru.toLowerCase()).not.toContain('smtp');
    expect(read(messages('en'), 'verifyEmail.initialSendFailed')).toBe(
      'We could not send the verification email. You can send the code again.',
    );
  });

  it.each(LOCALES)('%s has the initial delivery notice', (locale) => {
    const copy = read(messages(locale), 'verifyEmail.initialSendFailed');
    expect(copy.trim().length).toBeGreaterThan(20);
    expect(copy.toLowerCase()).not.toContain('smtp');
    expect(copy.toLowerCase()).not.toContain('stack');
    expect(read(messages(locale), 'verifyEmail.resend').trim().length).toBeGreaterThan(0);
    expect(read(messages(locale), 'verifyEmail.sentHint')).toContain('{email}');
  });
});
