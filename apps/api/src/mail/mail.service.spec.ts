import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

const SMTP_ENV = {
  MAIL_DRIVER: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 's3cret-token-value',
  MAIL_FROM: 'AgroBridge <noreply@agrobridge.ge>',
};

function buildService(env: Record<string, string> = {}) {
  return new MailService({ get: (key: string) => env[key] } as unknown as ConfigService);
}

describe('MailService console driver', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prints the body during development so codes can be copied from the console', async () => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport');
    await buildService().send({
      to: 'farmer@example.com',
      subject: 'Verification code',
      text: 'Your AgroBridge code is 123456',
    });

    expect(logged.join('\n')).toContain('123456');
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('never prints a verification code when console is explicitly allowed in production', async () => {
    await buildService({ NODE_ENV: 'production', MAIL_ALLOW_CONSOLE: 'true' }).send({
      to: 'farmer@example.com',
      subject: 'Verification code',
      text: 'Your AgroBridge code is 123456',
    });

    const output = logged.join('\n');
    expect(output).not.toContain('123456');
    expect(output).toContain('body omitted');
    expect(output).toContain('farmer@example.com');
  });
});

describe('MailService smtp driver', () => {
  const sendMail = jest.fn();
  let logged: string[];
  let errors: string[];

  beforeEach(() => {
    logged = [];
    errors = [];
    sendMail.mockReset();
    sendMail.mockResolvedValue({ messageId: '1' });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends through the SMTP transport with the configured From', async () => {
    const service = buildService(SMTP_ENV);
    await service.send({
      to: 'farmer@example.com',
      subject: 'პაროლის აღდგენა café',
      text: 'Hello ნინო',
      replyTo: undefined,
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: 'mailer', pass: 's3cret-token-value' },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        tls: { minVersion: 'TLSv1.2' },
      }),
    );
    const transportOpts = (nodemailer.createTransport as jest.Mock).mock.calls[0][0] as {
      tls?: { rejectUnauthorized?: boolean };
    };
    expect(transportOpts.tls?.rejectUnauthorized).not.toBe(false);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'AgroBridge <noreply@agrobridge.ge>',
        to: 'farmer@example.com',
        subject: 'პაროლის აღდგენა café',
        text: 'Hello ნინო',
      }),
    );
    expect(logged.join('\n')).not.toContain('s3cret-token-value');
    expect(logged.join('\n')).not.toContain('Hello ნინო');
  });

  it('passes Reply-To through when the caller sets it', async () => {
    const service = buildService(SMTP_ENV);
    await service.send({
      to: 'inbox@agrobridge.ge',
      replyTo: 'nino@example.com',
      subject: 'Support',
      text: 'Help',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'nino@example.com' }),
    );
  });

  it('does not put the SMTP password or a reset token into logs when send fails', async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error('auth failed SMTP_PASSWORD=s3cret-token-value token=opaque-reset-token'), {
        code: 'EAUTH',
        responseCode: 535,
      }),
    );
    const service = buildService(SMTP_ENV);

    await expect(
      service.send({
        to: 'farmer@example.com',
        subject: 'Reset your AgroBridge password',
        text: 'Set a new password: https://agrobridge.ge/en/reset-password?token=opaque-reset-token',
      }),
    ).rejects.toThrow('Email delivery failed');

    const output = [...logged, ...errors].join('\n');
    expect(output).not.toContain('s3cret-token-value');
    expect(output).not.toContain('opaque-reset-token');
    expect(output).not.toContain('123456');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('retries a transient timeout and then succeeds without duplicating the payload', async () => {
    sendMail
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce({ messageId: '2' });

    const service = buildService(SMTP_ENV);
    await service.send({
      to: 'farmer@example.com',
      subject: 'Your AgroBridge verification code',
      text: 'Your verification code is 123456',
    });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail.mock.calls[0][0]).toEqual(sendMail.mock.calls[1][0]);
    expect([...logged, ...errors].join('\n')).not.toContain('123456');
  });
});

const RESEND_ENV = {
  MAIL_DRIVER: 'resend',
  RESEND_API_KEY: 're_test_secret_key_value',
  MAIL_FROM: 'AgroBridge <no-reply@agrobridge.ge>',
};

function jsonResponse(status: number, body = '{"id":"email_1"}'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: jest.fn().mockResolvedValue(Buffer.from(body)),
  } as unknown as Response;
}

function bindFetch(service: MailService, fetchImpl: typeof fetch) {
  (service as unknown as { fetchImpl: typeof fetch }).fetchImpl = fetchImpl;
}

describe('MailService resend driver', () => {
  let logged: string[];
  let errors: string[];
  let fetchImpl: jest.Mock;

  beforeEach(() => {
    logged = [];
    errors = [];
    fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200));
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function service() {
    const instance = buildService(RESEND_ENV);
    bindFetch(instance, fetchImpl as unknown as typeof fetch);
    return instance;
  }

  it('sends through the Resend HTTPS API with the configured From', async () => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport');
    await service().send({
      to: 'farmer@example.com',
      subject: 'პაროლის აღდგენა café',
      text: 'Hello ნინო',
      html: '<p>Hello ნინო</p>',
    });

    expect(createTransport).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.resend.com/emails');
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.headers).toEqual({
      Authorization: 'Bearer re_test_secret_key_value',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'AgroBridge <no-reply@agrobridge.ge>',
      to: 'farmer@example.com',
      subject: 'პაროლის აღდგენა café',
      text: 'Hello ნინო',
      html: '<p>Hello ნინო</p>',
    });
    expect(logged.join('\n')).not.toContain('re_test_secret_key_value');
    expect(logged.join('\n')).not.toContain('Hello ნინო');
  });

  it('passes Reply-To through as reply_to and never as From', async () => {
    await service().send({
      to: 'inbox@agrobridge.ge',
      replyTo: 'nino@example.com',
      subject: 'Support',
      text: 'Help',
    });

    const body = JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body)) as {
      from: string;
      reply_to?: string;
    };
    expect(body.from).toBe('AgroBridge <no-reply@agrobridge.ge>');
    expect(body.reply_to).toBe('nino@example.com');
  });

  it('does not put the API key, Authorization header, reset URL, or email body into logs', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(401, '{"name":"invalid_api_key","message":"API key is invalid"}'));

    await expect(
      service().send({
        to: 'farmer@example.com',
        subject: 'Reset your AgroBridge password',
        text: 'Set a new password: https://agrobridge.ge/en/reset-password?token=opaque-reset-token',
        html: '<a href="https://agrobridge.ge/en/reset-password?token=opaque-reset-token">Reset</a>',
      }),
    ).rejects.toThrow('Email delivery failed');

    const output = [...logged, ...errors].join('\n');
    expect(output).not.toContain('re_test_secret_key_value');
    expect(output).not.toContain('Bearer re_');
    expect(output).not.toContain('Authorization');
    expect(output).not.toContain('opaque-reset-token');
    expect(output).not.toContain('reset-password');
    expect(output).not.toContain('invalid_api_key');
    expect(output).toContain('status=401');
    expect(output).toContain('retry=false');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, 2],
    [500, 2],
    [503, 2],
  ])('retries HTTP %s then succeeds with the same payload', async (status, calls) => {
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(status as number, '{"message":"try later"}'))
      .mockResolvedValueOnce(jsonResponse(200));

    await service().send({
      to: 'farmer@example.com',
      subject: 'Your AgroBridge verification code',
      text: 'Your verification code is 123456',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(calls);
    expect((fetchImpl.mock.calls[0][1] as RequestInit).body).toEqual(
      (fetchImpl.mock.calls[1][1] as RequestInit).body,
    );
    expect([...logged, ...errors].join('\n')).not.toContain('123456');
    expect([...logged, ...errors].join('\n')).not.toContain('try later');
  });

  it('retries a timeout then succeeds without changing the payload', async () => {
    fetchImpl
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      .mockResolvedValueOnce(jsonResponse(200));

    await service().send({
      to: 'farmer@example.com',
      subject: 'Reset',
      text: 'https://agrobridge.ge/en/reset-password?token=opaque-reset-token',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((fetchImpl.mock.calls[0][1] as RequestInit).body).toEqual(
      (fetchImpl.mock.calls[1][1] as RequestInit).body,
    );
    expect([...logged, ...errors].join('\n')).not.toContain('opaque-reset-token');
  });

  it.each([400, 401, 403])('does not retry HTTP %s', async (status) => {
    fetchImpl.mockResolvedValue(jsonResponse(status as number));

    await expect(
      service().send({
        to: 'farmer@example.com',
        subject: 'Reset',
        text: 'token=opaque-reset-token',
      }),
    ).rejects.toThrow('Email delivery failed');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(errors.join('\n')).toContain('retry=false');
  });

  it('stops after three transient failures', async () => {
    fetchImpl.mockResolvedValue(jsonResponse(503));

    await expect(
      service().send({
        to: 'farmer@example.com',
        subject: 'Reset',
        text: 'token=opaque-reset-token',
      }),
    ).rejects.toThrow('Email delivery failed');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(errors.filter((line) => line.includes('Resend send failed'))).toHaveLength(3);
  });
});
