import { ApiError } from '../api/errors';

export const VERIFICATION_CODE_LENGTH = 6;

export type VerifyEmailRoute = 'VerifyEmail';

export type CodeFieldCode = 'required' | 'invalid' | 'incomplete';

export type VerifyGate = {
  pending: boolean;
};

export type ConfirmEmailResult =
  | { ignored: true }
  | {
      ignored?: false;
      confirmed: boolean;
      fieldError: CodeFieldCode | null;
      formError: string | null;
    };

export type ResendEmailResult =
  | { ignored: true }
  | {
      ignored?: false;
      sent: boolean;
      destination: string | null;
      formError: string | null;
    };

/** Keeps only digits and never more than the backend code length. */
export function digitsOnlyCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH);
}

export function validateVerificationCode(code: string): CodeFieldCode | null {
  const trimmed = code.trim();
  if (!trimmed) {
    return 'required';
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'invalid';
  }
  if (trimmed.length !== VERIFICATION_CODE_LENGTH) {
    return 'incomplete';
  }
  return null;
}

/** Signed-in users who still need to confirm open the same screen. */
export function emailVerificationRoute(
  user: { emailVerified: boolean } | null | undefined,
): VerifyEmailRoute | null {
  if (!user || user.emailVerified) {
    return null;
  }
  return 'VerifyEmail';
}

export async function submitEmailConfirmation(options: {
  code: string;
  gate: VerifyGate;
  confirm: (code: string) => Promise<{ emailVerified: boolean }>;
  onPending: (pending: boolean) => void;
}): Promise<ConfirmEmailResult> {
  if (options.gate.pending) {
    return { ignored: true };
  }

  const fieldError = validateVerificationCode(options.code);
  if (fieldError) {
    return { confirmed: false, fieldError, formError: null };
  }

  options.gate.pending = true;
  options.onPending(true);
  try {
    const user = await options.confirm(options.code);
    return {
      confirmed: user.emailVerified,
      fieldError: null,
      formError: null,
    };
  } catch (error) {
    return {
      confirmed: false,
      fieldError: null,
      formError: error instanceof ApiError ? error.message : null,
    };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}

export async function submitEmailResend(options: {
  gate: VerifyGate;
  send: () => Promise<{ destination: string }>;
  onPending: (pending: boolean) => void;
}): Promise<ResendEmailResult> {
  if (options.gate.pending) {
    return { ignored: true };
  }

  options.gate.pending = true;
  options.onPending(true);
  try {
    const result = await options.send();
    return { sent: true, destination: result.destination, formError: null };
  } catch (error) {
    return {
      sent: false,
      destination: null,
      formError: error instanceof ApiError ? error.message : null,
    };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}
