import { ApiError } from '../api/errors';
import { submitLogin, validateLoginForm, type LoginGate } from './login-form';

const password = 'password1';

describe('validateLoginForm', () => {
  it('rejects an empty submission', () => {
    expect(validateLoginForm('  ', '')).toEqual({
      email: 'required',
      password: 'required',
    });
  });

  it('rejects an invalid email and a short password', () => {
    expect(validateLoginForm('not-an-email', 'short')).toEqual({
      email: 'invalid',
      password: 'tooShort',
    });
  });

  it('accepts a trimmed email and a password the API allows', () => {
    expect(validateLoginForm('  Ada@Example.com  ', password)).toEqual({});
  });
});

describe('submitLogin', () => {
  it('does not call login when validation fails', async () => {
    const login = jest.fn();
    const pending: boolean[] = [];
    const result = await submitLogin({
      email: '',
      password: '',
      gate: { pending: false },
      login,
      onPending: (value) => pending.push(value),
    });

    expect(login).not.toHaveBeenCalled();
    expect(pending).toEqual([]);
    expect(result).toEqual({
      signedIn: false,
      fieldErrors: { email: 'required', password: 'required' },
      formError: null,
    });
  });

  it('calls login with the entered credentials and clears the loading state', async () => {
    const login = jest.fn().mockResolvedValue({ id: 'user-1', emailVerified: false });
    const pending: boolean[] = [];
    const result = await submitLogin({
      email: ' Ada@Example.com ',
      password,
      gate: { pending: false },
      login,
      onPending: (value) => pending.push(value),
    });

    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith('ada@example.com', password);
    expect(pending).toEqual([true, false]);
    expect(result).toEqual({ signedIn: true, fieldErrors: {}, formError: null });
  });

  it('returns the API error and clears the loading state when login fails', async () => {
    const login = jest.fn().mockRejectedValue(
      new ApiError({ message: 'Invalid email or password', status: 401, kind: 'http' }),
    );
    const pending: boolean[] = [];
    const result = await submitLogin({
      email: 'ada@example.com',
      password,
      gate: { pending: false },
      login,
      onPending: (value) => pending.push(value),
    });

    expect(pending).toEqual([true, false]);
    expect(result).toEqual({
      signedIn: false,
      fieldErrors: {},
      formError: 'Invalid email or password',
    });
  });

  it('ignores a second submission while the first is still pending', async () => {
    let release: (() => void) | undefined;
    const login = jest.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ id: 'user-1' });
        }),
    );
    const gate: LoginGate = { pending: false };
    const first = submitLogin({
      email: 'ada@example.com',
      password,
      gate,
      login,
      onPending: () => undefined,
    });
    const second = await submitLogin({
      email: 'ada@example.com',
      password,
      gate,
      login,
      onPending: () => undefined,
    });

    expect(second).toEqual({ ignored: true });
    expect(login).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toMatchObject({ signedIn: true });
  });
});
