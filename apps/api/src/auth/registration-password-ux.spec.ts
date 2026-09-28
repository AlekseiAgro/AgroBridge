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

describe('registration password UX', () => {
  const form = source('components/AuthForm.tsx');
  const field = source('components/PasswordField.tsx');
  const css = source('app/globals.css');
  const reset = source('components/ResetPasswordForm.tsx');
  const change = source('components/ChangePasswordForm.tsx');
  const registerDto = readFileSync(join(__dirname, 'dto/register.dto.ts'), 'utf8');

  it('renders password and confirm password only on registration', () => {
    const loginStart = form.indexOf("{mode === 'login' ? (");
    const registerStart = form.indexOf(') : (', loginStart);
    const afterPasswords = form.indexOf("{mode === 'login' ? (", registerStart);
    const login = form.slice(loginStart, registerStart);
    const register = form.slice(registerStart, afterPasswords);
    expect(login).toContain('type="password"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).not.toContain('PasswordField');
    expect(login).not.toContain('confirmPassword');
    expect(register).toContain('id="register-password"');
    expect(register).toContain('id="register-confirm-password"');
    expect(register).toContain("label={t('password')}");
    expect(register).toContain("label={t('confirmPassword')}");
    expect(register).toContain('name="password"');
    expect(register).toContain('name="confirmPassword"');
  });

  it('hides both fields by default and toggles them independently', () => {
    expect(form).toContain('const [showPassword, setShowPassword] = useState(false)');
    expect(form).toContain('const [showConfirmPassword, setShowConfirmPassword] = useState(false)');
    expect(form).toContain('shown={showPassword}');
    expect(form).toContain('shown={showConfirmPassword}');
    expect(form).toContain('onToggle={() => setShowPassword((current) => !current)}');
    expect(form).toContain('onToggle={() => setShowConfirmPassword((current) => !current)}');
    expect(field).toContain("type={shown ? 'text' : 'password'}");
    expect(field).toContain('type="button"');
    expect(field).toContain('aria-label={visibilityLabel}');
    expect(field).toContain('aria-pressed={shown}');
    expect(field).not.toContain('value={');
    expect(field).not.toContain('onPaste');
    expect(field).not.toContain('autoComplete="off"');
    expect(field).not.toContain('localStorage');
    expect(css).toContain('.password-field');
    expect(css).toContain('min-width: 2.75rem');
    expect(css).toContain('min-width: 0');
  });

  it('blocks mismatched passwords before the registration request and omits confirmPassword', () => {
    const check = form.indexOf("t('passwordsDoNotMatch')");
    const request = form.indexOf('fetch(`/api/auth/${mode}`');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(request);
    const registerPayload = form.slice(
      form.indexOf("mode === 'login'"),
      form.indexOf('try {'),
    );
    const body = registerPayload.slice(registerPayload.lastIndexOf(': {'));
    expect(body).toContain('password: String(form.get(\'password\') ?? \'\')');
    expect(body).not.toContain('confirmPassword');
    expect(field).toContain('minLength={8}');
    expect(field).toContain('maxLength={128}');
    expect(field).toContain('autoComplete={autoComplete}');
    expect(registerDto).toContain('@MinLength(8)');
    expect(registerDto).toContain('@MaxLength(128)');
    expect(registerDto).not.toContain('confirmPassword');
  });

  it('keeps registration success, verification, login, and password recovery paths', () => {
    expect(form).toContain('`/verify-email?${verifyParams.toString()}`');
    expect(form).toContain("verifyParams.set('verificationEmail', 'unsent')");
    expect(form).toContain('router.replace(destination)');
    expect(reset).toContain('name="confirmPassword"');
    expect(reset).toContain("t('passwordMismatch')");
    expect(reset).not.toContain('PasswordField');
    expect(change).toContain('name="confirmNewPassword"');
    expect(change).toContain("t('passwordMismatch')");
    expect(change).not.toContain('PasswordField');
    expect(form).not.toContain('localStorage');
    expect(form).not.toContain('onPaste');
  });

  it('uses the requested Russian password copy', () => {
    const ru = messages('ru');
    expect(read(ru, 'auth.password')).toBe('Пароль');
    expect(read(ru, 'auth.confirmPassword')).toBe('Подтвердите пароль');
    expect(read(ru, 'auth.showPassword')).toBe('Показывать пароль');
    expect(read(ru, 'auth.hidePassword')).toBe('Скрыть пароль');
    expect(read(ru, 'auth.passwordsDoNotMatch')).toBe('Пароли не совпадают');
    expect(read(ru, 'auth.passwordMismatch')).toBe('Новые пароли не совпадают.');
  });

  it.each(LOCALES)('%s has registration password strings', (locale) => {
    const data = messages(locale);
    for (const key of [
      'auth.password',
      'auth.confirmPassword',
      'auth.showPassword',
      'auth.hidePassword',
      'auth.passwordsDoNotMatch',
    ]) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
  });
});
