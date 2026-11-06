import { ApiError } from '../api/errors';
import {
  registrationBody,
  registrationCanOpenVerifyEmail,
  submitRegistration,
  termsVersionFromDocuments,
  validateRegisterForm,
  type RegisterAccountResult,
  type RegisterGate,
} from './register-form';

const password = 'password1';

const valid = {
  email: ' Ada@Example.com ',
  password,
  confirmPassword: password,
  displayName: ' Ada ',
  role: 'farmer',
  acceptTerms: true,
};

describe('validateRegisterForm', () => {
  it('rejects empty required fields', () => {
    expect(
      validateRegisterForm({
        email: ' ',
        password: '',
        confirmPassword: '',
        displayName: '',
        role: '',
        acceptTerms: false,
      }),
    ).toEqual({
      email: 'required',
      password: 'required',
      confirmPassword: 'required',
      role: 'required',
      terms: 'required',
    });
  });

  it('rejects an invalid email and a short password', () => {
    expect(
      validateRegisterForm({
        ...valid,
        email: 'not-an-email',
        password: 'short',
        confirmPassword: 'short',
      }),
    ).toMatchObject({
      email: 'invalid',
      password: 'tooShort',
    });
  });

  it('rejects a confirmation that does not match', () => {
    expect(
      validateRegisterForm({
        ...valid,
        confirmPassword: 'password2',
      }).confirmPassword,
    ).toBe('mismatch');
  });

  it('accepts the fields the API requires', () => {
    expect(validateRegisterForm(valid)).toEqual({});
  });
});

describe('registrationBody', () => {
  it('matches the registration contract and omits a blank display name', () => {
    expect(
      registrationBody({
        email: ' Ada@Example.com ',
        password,
        role: 'buyer',
        displayName: '  ',
        locale: 'ka',
        acceptedTermsVersion: '1.0',
      }),
    ).toEqual({
      email: 'ada@example.com',
      password,
      role: 'buyer',
      locale: 'ka',
      acceptTerms: true,
      acceptedTermsVersion: '1.0',
      acceptedTermsLocale: 'ka',
    });
  });
});

describe('termsVersionFromDocuments', () => {
  it('reads the published terms version and falls back otherwise', () => {
    expect(
      termsVersionFromDocuments({
        documents: [{ type: 'TERMS', version: '2.1' }],
      }),
    ).toBe('2.1');
    expect(termsVersionFromDocuments(null)).toBe('1.0');
  });
});

describe('submitRegistration', () => {
  it('does not call register when validation fails', async () => {
    const register = jest.fn();
    const pending: boolean[] = [];
    const result = await submitRegistration({
      ...valid,
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      locale: 'en',
      acceptedTermsVersion: '1.0',
      gate: { pending: false },
      register,
      onPending: (value) => pending.push(value),
    });

    expect(register).not.toHaveBeenCalled();
    expect(pending).toEqual([]);
    expect(result).toMatchObject({ signedIn: false, duplicateEmail: false, formError: null });
  });

  it('registers with the API body and clears the loading state', async () => {
    const register = jest.fn().mockResolvedValue({
      emailVerified: false,
      verificationEmailSent: true,
    });
    const pending: boolean[] = [];
    const result = await submitRegistration({
      ...valid,
      locale: 'en',
      acceptedTermsVersion: '1.0',
      gate: { pending: false },
      register,
      onPending: (value) => pending.push(value),
    });

    expect(register).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password,
      role: 'farmer',
      displayName: 'Ada',
      locale: 'en',
      acceptTerms: true,
      acceptedTermsVersion: '1.0',
      acceptedTermsLocale: 'en',
    });
    expect(pending).toEqual([true, false]);
    expect(result).toMatchObject({
      signedIn: true,
      emailVerified: false,
      verificationEmailSent: true,
    });
  });

  it('reports a duplicate email without the raw API message', async () => {
    const register = jest.fn().mockRejectedValue(
      new ApiError({ message: 'Email is already registered', status: 409, kind: 'http' }),
    );
    const pending: boolean[] = [];
    const result = await submitRegistration({
      ...valid,
      locale: 'en',
      acceptedTermsVersion: '1.0',
      gate: { pending: false },
      register,
      onPending: (value) => pending.push(value),
    });

    expect(pending).toEqual([true, false]);
    expect(result).toMatchObject({
      signedIn: false,
      duplicateEmail: true,
      formError: null,
    });
  });

  it('returns the API message for other failures and clears loading', async () => {
    const register = jest.fn().mockRejectedValue(
      new ApiError({ message: 'Network request failed.', status: 0, kind: 'network' }),
    );
    const pending: boolean[] = [];
    const result = await submitRegistration({
      ...valid,
      locale: 'ru',
      acceptedTermsVersion: '1.0',
      gate: { pending: false },
      register,
      onPending: (value) => pending.push(value),
    });

    expect(pending).toEqual([true, false]);
    expect(result).toMatchObject({
      signedIn: false,
      duplicateEmail: false,
      formError: 'Network request failed.',
    });
  });

  it('ignores a second submission while the first is still pending', async () => {
    let release: (() => void) | undefined;
    const register = jest.fn(
      () =>
        new Promise<RegisterAccountResult>((resolve) => {
          release = () =>
            resolve({ emailVerified: false, verificationEmailSent: false });
        }),
    );
    const gate: RegisterGate = { pending: false };
    const first = submitRegistration({
      ...valid,
      locale: 'en',
      acceptedTermsVersion: '1.0',
      gate,
      register,
      onPending: () => undefined,
    });
    const second = await submitRegistration({
      ...valid,
      locale: 'en',
      acceptedTermsVersion: '1.0',
      gate,
      register,
      onPending: () => undefined,
    });

    expect(second).toEqual({ ignored: true });
    expect(register).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toMatchObject({
      signedIn: true,
      verificationEmailSent: false,
    });
  });

  it('offers email confirmation only for a signed-in unverified account', () => {
    expect(registrationCanOpenVerifyEmail({ signedIn: true, emailVerified: false })).toBe(true);
    expect(registrationCanOpenVerifyEmail({ signedIn: true, emailVerified: true })).toBe(false);
    expect(registrationCanOpenVerifyEmail({ signedIn: false, emailVerified: false })).toBe(false);
  });
});
