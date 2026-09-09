import type { MailMessage } from './mail.types';
import {
  buildResendPayload,
  isRetryableResendStatus,
  isTransientResendError,
  RESEND_EMAILS_URL,
  ResendHttpError,
  sendResendHttp,
} from './resend-http';

const API_KEY = 're_test_secret_key_value';
const FROM = 'AgroBridge <no-reply@agrobridge.ge>';
const MESSAGE: MailMessage = {
  to: 'farmer@example.com',
  subject: 'Reset your AgroBridge password',
  text: 'Set a new password: https://agrobridge.ge/en/reset-password?token=opaque-reset-token',
  html: '<p>Reset</p>',
};

function jsonResponse(status: number, body = '{"id":"email_1"}'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: jest.fn().mockResolvedValue(Buffer.from(body)),
  } as unknown as Response;
}

describe('buildResendPayload', () => {
  it('omits html and reply_to when they are absent', () => {
    expect(
      buildResendPayload(FROM, { to: 'a@b.c', subject: 'Hi', text: 'Hello' }),
    ).toEqual({
      from: FROM,
      to: 'a@b.c',
      subject: 'Hi',
      text: 'Hello',
    });
  });

  it('includes html and reply_to when the caller sets them', () => {
    expect(
      buildResendPayload(FROM, {
        to: 'inbox@agrobridge.ge',
        subject: 'Support',
        text: 'Help',
        html: '<p>Help</p>',
        replyTo: 'nino@example.com',
      }),
    ).toEqual({
      from: FROM,
      to: 'inbox@agrobridge.ge',
      subject: 'Support',
      text: 'Help',
      html: '<p>Help</p>',
      reply_to: 'nino@example.com',
    });
  });
});

describe('isRetryableResendStatus', () => {
  it('retries throttling and upstream failures only', () => {
    expect(isRetryableResendStatus(429)).toBe(true);
    expect(isRetryableResendStatus(500)).toBe(true);
    expect(isRetryableResendStatus(502)).toBe(true);
    expect(isRetryableResendStatus(503)).toBe(true);
    expect(isRetryableResendStatus(504)).toBe(true);
    expect(isRetryableResendStatus(400)).toBe(false);
    expect(isRetryableResendStatus(401)).toBe(false);
    expect(isRetryableResendStatus(403)).toBe(false);
    expect(isRetryableResendStatus(422)).toBe(false);
  });
});

describe('isTransientResendError', () => {
  it('retries timeouts and network failures, not auth errors', () => {
    expect(isTransientResendError(new ResendHttpError(429, true))).toBe(true);
    expect(isTransientResendError(new ResendHttpError(401, false))).toBe(false);
    expect(isTransientResendError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(
      true,
    );
    expect(isTransientResendError(new TypeError('fetch failed'))).toBe(true);
    expect(isTransientResendError(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))).toBe(
      true,
    );
  });
});

describe('sendResendHttp', () => {
  it('posts to the Resend emails endpoint with Bearer auth and the configured From', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200));

    await sendResendHttp({
      apiKey: API_KEY,
      from: FROM,
      message: MESSAGE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(RESEND_EMAILS_URL);
    expect(RESEND_EMAILS_URL).toBe('https://api.resend.com/emails');

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      from: FROM,
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      text: MESSAGE.text,
      html: MESSAGE.html,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not let the message choose From', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200));
    await sendResendHttp({
      apiKey: API_KEY,
      from: FROM,
      message: { ...MESSAGE, to: 'attacker@example.com' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body)).from).toBe(FROM);
  });

  it('throws a status-only error for permanent HTTP failures', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(401, '{"message":"invalid_api_key"}'));

    await expect(
      sendResendHttp({
        apiKey: API_KEY,
        from: FROM,
        message: MESSAGE,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      name: 'ResendHttpError',
      status: 401,
      retryable: false,
      message: 'Resend HTTP 401',
    });
  });

  it('aborts a hung request', async () => {
    const fetchImpl = jest.fn((_url: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        });
      });
    });

    await expect(
      sendResendHttp({
        apiKey: API_KEY,
        from: FROM,
        message: MESSAGE,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        timeoutMs: 20,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
