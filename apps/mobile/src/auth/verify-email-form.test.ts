import { ApiError } from '../api/errors';
import {
  digitsOnlyCode,
  emailVerificationRoute,
  submitEmailConfirmation,
  submitEmailResend,
  validateVerificationCode,
  type VerifyGate,
} from './verify-email-form';

describe('validateVerificationCode', () => {
  it('rejects an empty code', () => {
    expect(validateVerificationCode('')).toBe('required');
    expect(validateVerificationCode('   ')).toBe('required');
  });

  it('rejects a non-numeric code', () => {
    expect(validateVerificationCode('12ab34')).toBe('invalid');
  });

  it('rejects fewer than 6 digits', () => {
    expect(validateVerificationCode('12345')).toBe('incomplete');
  });

  it('accepts exactly 6 digits', () => {
    expect(validateVerificationCode('123456')).toBeNull();
  });
});

describe('digitsOnlyCode', () => {
  it('drops non-digits and keeps at most 6 digits', () => {
    expect(digitsOnlyCode('12ab3456789')).toBe('123456');
  });
});

describe('emailVerificationRoute', () => {
  it('opens VerifyEmail for an unverified account and hides it once verified', () => {
    expect(emailVerificationRoute({ emailVerified: false })).toBe('VerifyEmail');
    expect(emailVerificationRoute({ emailVerified: true })).toBeNull();
    expect(emailVerificationRoute(null)).toBeNull();
  });
});

describe('submitEmailConfirmation', () => {
  it('does not call confirm when the code is empty, non-numeric, or short', async () => {
    const confirm = jest.fn();
    const gate: VerifyGate = { pending: false };

    await expect(
      submitEmailConfirmation({ code: '', gate, confirm, onPending: () => undefined }),
    ).resolves.toMatchObject({ confirmed: false, fieldError: 'required' });
    await expect(
      submitEmailConfirmation({ code: '12ab34', gate, confirm, onPending: () => undefined }),
    ).resolves.toMatchObject({ confirmed: false, fieldError: 'invalid' });
    await expect(
      submitEmailConfirmation({ code: '12345', gate, confirm, onPending: () => undefined }),
    ).resolves.toMatchObject({ confirmed: false, fieldError: 'incomplete' });

    expect(confirm).not.toHaveBeenCalled();
  });

  it('confirms a 6-digit code', async () => {
    const confirm = jest.fn().mockResolvedValue({ emailVerified: true });
    const result = await submitEmailConfirmation({
      code: '123456',
      gate: { pending: false },
      confirm,
      onPending: () => undefined,
    });

    expect(confirm).toHaveBeenCalledWith('123456');
    expect(result).toEqual({ confirmed: true, fieldError: null, formError: null });
  });

  it('keeps the API message when confirmation fails', async () => {
    const confirm = jest.fn().mockRejectedValue(
      new ApiError({
        message: 'Invalid or expired verification code',
        status: 400,
        kind: 'http',
      }),
    );
    const result = await submitEmailConfirmation({
      code: '123456',
      gate: { pending: false },
      confirm,
      onPending: () => undefined,
    });

    expect(result).toEqual({
      confirmed: false,
      fieldError: null,
      formError: 'Invalid or expired verification code',
    });
  });

  it('reports loading and then clears it', async () => {
    const confirm = jest.fn().mockResolvedValue({ emailVerified: true });
    const pending: boolean[] = [];
    await submitEmailConfirmation({
      code: '123456',
      gate: { pending: false },
      confirm,
      onPending: (value) => pending.push(value),
    });
    expect(pending).toEqual([true, false]);
  });

  it('ignores a second submit while the first is in progress', async () => {
    let release: (() => void) | undefined;
    const confirm = jest.fn(
      () =>
        new Promise<{ emailVerified: boolean }>((resolve) => {
          release = () => resolve({ emailVerified: true });
        }),
    );
    const gate: VerifyGate = { pending: false };
    const first = submitEmailConfirmation({
      code: '123456',
      gate,
      confirm,
      onPending: () => undefined,
    });
    const second = await submitEmailConfirmation({
      code: '123456',
      gate,
      confirm,
      onPending: () => undefined,
    });

    expect(second).toEqual({ ignored: true });
    expect(confirm).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toMatchObject({ confirmed: true });
  });
});

describe('submitEmailResend', () => {
  it('returns the destination when the code is sent', async () => {
    const send = jest.fn().mockResolvedValue({ destination: 'ada@example.com' });
    const result = await submitEmailResend({
      gate: { pending: false },
      send,
      onPending: () => undefined,
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: true, destination: 'ada@example.com', formError: null });
  });

  it('keeps the API message when resend fails', async () => {
    const send = jest.fn().mockRejectedValue(
      new ApiError({
        message: 'Too many requests',
        status: 429,
        kind: 'http',
      }),
    );
    const result = await submitEmailResend({
      gate: { pending: false },
      send,
      onPending: () => undefined,
    });

    expect(result).toEqual({ sent: false, destination: null, formError: 'Too many requests' });
  });

  it('ignores a second resend while the first is in progress', async () => {
    let release: (() => void) | undefined;
    const send = jest.fn(
      () =>
        new Promise<{ destination: string }>((resolve) => {
          release = () => resolve({ destination: 'ada@example.com' });
        }),
    );
    const gate: VerifyGate = { pending: false };
    const first = submitEmailResend({ gate, send, onPending: () => undefined });
    const second = await submitEmailResend({ gate, send, onPending: () => undefined });

    expect(second).toEqual({ ignored: true });
    expect(send).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toMatchObject({ sent: true });
  });
});
