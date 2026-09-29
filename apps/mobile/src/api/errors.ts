export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted';

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly retryAfterSeconds: number | null;
  readonly details: string | null;

  constructor(options: {
    message: string;
    status: number;
    kind: ApiErrorKind;
    retryAfterSeconds?: number | null;
    details?: string | null;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.kind = options.kind;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.details = options.details ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
