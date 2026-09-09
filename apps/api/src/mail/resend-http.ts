import type { MailMessage } from './mail.types';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const RESEND_REQUEST_TIMEOUT_MS = 10_000;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

export class ResendHttpError extends Error {
  readonly status: number;
  readonly classification: string;
  readonly retryable: boolean;

  constructor(status: number, retryable: boolean) {
    super(`Resend HTTP ${status}`);
    this.name = 'ResendHttpError';
    this.status = status;
    this.classification = `http_${status}`;
    this.retryable = retryable;
  }
}

export function isRetryableResendStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError' || name === 'TimeoutError';
}

export function isTransientResendError(error: unknown): boolean {
  if (error instanceof ResendHttpError) {
    return error.retryable;
  }
  if (isAbortError(error)) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = 'code' in error ? String(error.code) : '';
  return NETWORK_CODES.has(code);
}

export function classifyResendError(error: unknown): { status: string; classification: string } {
  if (error instanceof ResendHttpError) {
    return { status: String(error.status), classification: error.classification };
  }
  if (isAbortError(error)) {
    return { status: 'none', classification: 'timeout' };
  }
  return { status: 'none', classification: 'network' };
}

export function buildResendPayload(from: string, message: MailMessage): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  };
  if (message.html) {
    payload.html = message.html;
  }
  if (message.replyTo) {
    payload.reply_to = message.replyTo;
  }
  return payload;
}

export async function sendResendHttp(opts: {
  apiKey: string;
  from: string;
  message: MailMessage;
  fetchImpl: typeof fetch;
  timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? RESEND_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await opts.fetchImpl(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildResendPayload(opts.from, opts.message)),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Drain without parsing: Resend error bodies must never reach logs or callers.
      await response.arrayBuffer().catch(() => undefined);
      throw new ResendHttpError(response.status, isRetryableResendStatus(response.status));
    }

    await response.arrayBuffer().catch(() => undefined);
  } finally {
    clearTimeout(timer);
  }
}
