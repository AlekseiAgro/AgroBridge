import { ConfigService } from '@nestjs/config';
import { SUPPORT_EMAIL } from '@agrobridge/shared';
import type { MailService } from '../mail/mail.service';
import { RateLimitExceededException } from '../rate-limit/rate-limit-exceeded.exception';
import { createTestRateLimit } from '../rate-limit/rate-limit.test-utils';
import { SupportService } from './support.service';

function buildService(env: Record<string, string> = {}) {
  const send = jest.fn().mockResolvedValue(undefined);
  const { service: rateLimit } = createTestRateLimit(env);
  const service = new SupportService(
    { send } as unknown as MailService,
    { get: () => undefined } as ConfigService,
    rateLimit,
  );
  return { service, send };
}

const request = {
  name: 'Nino',
  email: 'nino@example.com',
  subject: 'Catalog question',
  message: 'How do I publish a product?',
};

describe('SupportService', () => {
  it('sends a support request to the configured inbox', async () => {
    const { service, send } = buildService();

    await expect(service.submit(request, '203.0.113.10')).resolves.toEqual({ ok: true });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: SUPPORT_EMAIL,
        replyTo: 'nino@example.com',
        subject: '[Support] Catalog question',
      }),
    );
  });

  it('throttles repeated submissions from one address', async () => {
    const { service, send } = buildService({ RATE_LIMIT_SUPPORT_IP_MAX: '3' });

    for (let i = 0; i < 3; i += 1) {
      await expect(
        service.submit({ ...request, email: `sender${i}@example.com` }, '203.0.113.10'),
      ).resolves.toEqual({ ok: true });
    }

    await expect(
      service.submit({ ...request, email: 'sender9@example.com' }, '203.0.113.10'),
    ).rejects.toBeInstanceOf(RateLimitExceededException);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('throttles one sender spread across many addresses', async () => {
    const { service } = buildService({
      RATE_LIMIT_SUPPORT_IP_MAX: '100',
      RATE_LIMIT_SUPPORT_EMAIL_MAX: '2',
    });

    await expect(service.submit(request, '198.51.100.1')).resolves.toEqual({ ok: true });
    await expect(service.submit(request, '198.51.100.2')).resolves.toEqual({ ok: true });
    await expect(service.submit(request, '198.51.100.3')).rejects.toBeInstanceOf(
      RateLimitExceededException,
    );
  });

  it('lets a different address through while one is throttled', async () => {
    const { service } = buildService({ RATE_LIMIT_SUPPORT_IP_MAX: '1' });

    await expect(service.submit(request, '203.0.113.10')).resolves.toEqual({ ok: true });
    await expect(service.submit(request, '203.0.113.10')).rejects.toBeInstanceOf(
      RateLimitExceededException,
    );
    await expect(
      service.submit({ ...request, email: 'other@example.com' }, '203.0.113.11'),
    ).resolves.toEqual({ ok: true });
  });
});
