import { ApiError } from '../api/errors';
import type { RegisterRequest } from './session';

/** Matches `RegisterDto`. Confirmation is checked only on the device. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 255;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const DISPLAY_NAME_MAX = 120;

export const FALLBACK_TERMS_VERSION = '1.0';

export type RegisterRole = 'farmer' | 'buyer';

export type RegisterField = 'email' | 'password' | 'confirmPassword' | 'displayName' | 'role' | 'terms';
export type RegisterFieldCode = 'required' | 'invalid' | 'tooShort' | 'tooLong' | 'mismatch';
export type RegisterFieldErrors = Partial<Record<RegisterField, RegisterFieldCode>>;

export type RegisterGate = {
  pending: boolean;
};

/** An unverified session can open the existing email-code screen. */
export function registrationCanOpenVerifyEmail(result: {
  signedIn: boolean;
  emailVerified: boolean;
}): boolean {
  return result.signedIn && !result.emailVerified;
}

export type RegisterAccountResult = {
  emailVerified: boolean;
  verificationEmailSent: boolean;
};

export type RegisterSubmitResult =
  | { ignored: true }
  | {
      ignored?: false;
      signedIn: boolean;
      emailVerified: boolean;
      verificationEmailSent: boolean;
      fieldErrors: RegisterFieldErrors;
      /** Set for a duplicate email so the screen can translate it. */
      duplicateEmail: boolean;
      formError: string | null;
    };

export function validateRegisterForm(input: {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  role: string;
  acceptTerms: boolean;
}): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const trimmedEmail = input.email.trim();
  if (!trimmedEmail) {
    errors.email = 'required';
  } else if (trimmedEmail.length > EMAIL_MAX || !EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'invalid';
  }

  if (!input.password) {
    errors.password = 'required';
  } else if (input.password.length < PASSWORD_MIN) {
    errors.password = 'tooShort';
  } else if (input.password.length > PASSWORD_MAX) {
    errors.password = 'tooLong';
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'required';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'mismatch';
  }

  if (input.displayName.trim().length > DISPLAY_NAME_MAX) {
    errors.displayName = 'tooLong';
  }

  if (input.role !== 'farmer' && input.role !== 'buyer') {
    errors.role = 'required';
  }

  if (!input.acceptTerms) {
    errors.terms = 'required';
  }

  return errors;
}

export function registrationBody(input: {
  email: string;
  password: string;
  role: RegisterRole;
  displayName: string;
  locale: string;
  acceptedTermsVersion: string;
}): RegisterRequest {
  const displayName = input.displayName.trim();
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    role: input.role,
    ...(displayName ? { displayName } : {}),
    locale: input.locale,
    acceptTerms: true,
    acceptedTermsVersion: input.acceptedTermsVersion.trim() || FALLBACK_TERMS_VERSION,
    acceptedTermsLocale: input.locale === 'ka' ? 'ka' : 'en',
  };
}

export function termsVersionFromDocuments(body: unknown): string {
  if (!body || typeof body !== 'object' || !('documents' in body)) {
    return FALLBACK_TERMS_VERSION;
  }
  const documents = (body as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) {
    return FALLBACK_TERMS_VERSION;
  }
  const terms = documents.filter(
    (document) =>
      !!document &&
      typeof document === 'object' &&
      (document as { type?: unknown }).type === 'TERMS',
  );
  if (terms.length !== 1) {
    return FALLBACK_TERMS_VERSION;
  }
  const version = (terms[0] as { version?: unknown }).version;
  return typeof version === 'string' && version.trim() ? version.trim() : FALLBACK_TERMS_VERSION;
}

function hasFieldErrors(errors: RegisterFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export async function submitRegistration(options: {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  role: string;
  acceptTerms: boolean;
  locale: string;
  acceptedTermsVersion: string;
  gate: RegisterGate;
  register: (body: RegisterRequest) => Promise<RegisterAccountResult>;
  onPending: (pending: boolean) => void;
}): Promise<RegisterSubmitResult> {
  if (options.gate.pending) {
    return { ignored: true };
  }

  const fieldErrors = validateRegisterForm(options);
  if (hasFieldErrors(fieldErrors)) {
    return {
      signedIn: false,
      emailVerified: false,
      verificationEmailSent: false,
      fieldErrors,
      duplicateEmail: false,
      formError: null,
    };
  }

  const role: RegisterRole = options.role === 'buyer' ? 'buyer' : 'farmer';
  options.gate.pending = true;
  options.onPending(true);
  try {
    const result = await options.register(
      registrationBody({
        email: options.email,
        password: options.password,
        role,
        displayName: options.displayName,
        locale: options.locale,
        acceptedTermsVersion: options.acceptedTermsVersion,
      }),
    );
    return {
      signedIn: true,
      emailVerified: result.emailVerified,
      verificationEmailSent: result.verificationEmailSent,
      fieldErrors: {},
      duplicateEmail: false,
      formError: null,
    };
  } catch (error) {
    const duplicateEmail = error instanceof ApiError && error.status === 409;
    return {
      signedIn: false,
      emailVerified: false,
      verificationEmailSent: false,
      fieldErrors: {},
      duplicateEmail,
      formError: error instanceof ApiError && !duplicateEmail ? error.message : null,
    };
  } finally {
    options.gate.pending = false;
    options.onPending(false);
  }
}
