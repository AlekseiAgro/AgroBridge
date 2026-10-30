import { ApiError } from '../api/errors';

/** Matches `LoginDto`: email, password of 8–128 characters. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 255;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export type LoginField = 'email' | 'password';
export type LoginFieldCode = 'required' | 'invalid' | 'tooShort' | 'tooLong';
export type LoginFieldErrors = Partial<Record<LoginField, LoginFieldCode>>;

export type LoginGate = {
  pending: boolean;
};

export type LoginSubmitResult =
  | { ignored: true }
  | {
      ignored?: false;
      signedIn: boolean;
      fieldErrors: LoginFieldErrors;
      formError: string | null;
    };

export function validateLoginForm(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'required';
  } else if (trimmedEmail.length > EMAIL_MAX || !EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'invalid';
  }

  if (!password) {
    errors.password = 'required';
  } else if (password.length < PASSWORD_MIN) {
    errors.password = 'tooShort';
  } else if (password.length > PASSWORD_MAX) {
    errors.password = 'tooLong';
  }

  return errors;
}

export function loginCredentials(email: string, password: string): { email: string; password: string } {
  return { email: email.trim().toLowerCase(), password };
}

export async function submitLogin(options: {
  email: string;
  password: string;
  gate: LoginGate;
  login: (email: string, password: string) => Promise<unknown>;
  onPending: (pending: boolean) => void;
}): Promise<LoginSubmitResult> {
  if (options.gate.pending) {
    return { ignored: true };
  }

  const fieldErrors = validateLoginForm(options.email, options.password);
  if (fieldErrors.email || fieldErrors.password) {
    return { signedIn: false, fieldErrors, formError: null };
  }

  options.gate.pending = true;
  options.onPending(true);
  try {
    const credentials = loginCredentials(options.email, options.password);
    await options.login(credentials.email, credentials.password);
    return { signedIn: true, fieldErrors: {}, formError: null };
  } catch (error) {
    return {
      signedIn: false,
      fieldErrors: {},
      formError: error instanceof ApiError ? error.message : null,
    };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}
