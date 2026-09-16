import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import type { MailService } from './mail.service';

describe('NotificationsService', () => {
  const mail = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(
      mail as unknown as MailService,
      {
        get: (key: string) => {
          if (key === 'WEB_PUBLIC_URL') return 'http://localhost:3000';
          return undefined;
        },
      } as ConfigService,
      {
        userNotification: {
          create: jest.fn().mockResolvedValue({}),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
        },
      } as never,
    );
  });

  it('sends verification through the mail abstraction with a UTF-8 subject', async () => {
    await service.notifyVerificationCode({
      user: { email: 'farmer@example.com', locale: 'ka', displayName: 'ნინო' },
      code: '123456',
      channel: 'email',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'farmer@example.com',
        subject: 'AgroBridge-ის ვერიფიკაციის კოდი',
        text: expect.stringContaining('123456'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain('ნინო');
  });

  it('sends a localized welcome email', async () => {
    await service.notifyWelcome({
      email: 'farmer@example.com',
      locale: 'ru',
      displayName: 'Nino',
      role: 'farmer',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'farmer@example.com',
        subject: expect.stringContaining('AgroBridge'),
        text: expect.stringContaining('Nino'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain('http://localhost:3000/ru/verify-email');
  });

  it('does not throw when mail delivery fails', async () => {
    mail.send.mockRejectedValueOnce(new Error('smtp down'));

    await expect(
      service.notifyProductApproved({
        farmer: {
          email: 'farmer@example.com',
          locale: 'en',
          displayName: 'Farmer',
        },
        productTitle: 'Hazelnuts',
        productId: 'p1',
      }),
    ).resolves.toBeUndefined();
  });

  it('sends a localized product pending moderation email', async () => {
    await service.notifyProductPendingModeration({
      admin: {
        email: 'admin@example.com',
        locale: 'ru',
        displayName: 'Admin',
      },
      productTitle: 'Hazelnuts',
      productId: 'p1',
      sellerName: 'Nino',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: expect.stringContaining('Hazelnuts'),
        text: expect.stringContaining('Nino'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain(
      'http://localhost:3000/ru/dashboard/admin?section=products&status=pending',
    );
  });

  it('sends a localized chat message email', async () => {
    await service.notifyChatMessage({
      recipient: {
        email: 'buyer@example.com',
        locale: 'ru',
        displayName: 'Buyer',
      },
      senderName: 'Nino',
      preview: 'Hello from the farm',
      conversationId: 'c1',
    });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        subject: expect.stringContaining('Nino'),
        text: expect.stringContaining('Hello from the farm'),
      }),
    );
    expect(mail.send.mock.calls[0][0].text).toContain(
      'http://localhost:3000/ru/dashboard/chat/c1',
    );
  });

  it('tells admins a verification needs review without exposing the document', async () => {
    await service.notifyVerificationPendingModeration({
      admin: { email: 'admin@agrobridge.ge', locale: 'ru', displayName: 'Admin' },
      farmId: 'farm1',
      farmName: 'Kakheti Farm',
      sellerType: 'privateFarmer',
      submittedAt: new Date('2026-09-16T10:30:00.000Z'),
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.to).toBe('admin@agrobridge.ge');
    expect(sent.subject).toContain('Kakheti Farm');
    expect(sent.text).toContain('частный фермер');
    expect(sent.text).toContain('farm1');
    expect(sent.text).toContain(
      'http://localhost:3000/ru/dashboard/admin?section=farms&status=documents',
    );
    expect(sent.text).not.toContain('/api/uploads/');
    expect(sent.text).not.toContain('farms/farm1/documents');
    expect(sent.text).not.toContain('/file');
  });

  it('reports whether the verification alert reached the admin', async () => {
    const params = {
      admin: { email: 'admin@agrobridge.ge', locale: 'ru', displayName: 'Admin' },
      farmId: 'farm1',
      farmName: 'Kakheti Farm',
      sellerType: 'privateFarmer' as const,
      submittedAt: new Date('2026-09-16T10:30:00.000Z'),
    };

    await expect(service.notifyVerificationPendingModeration(params)).resolves.toBe(true);

    mail.send.mockRejectedValueOnce(new Error('resend unavailable'));
    // Delivery failures stay non-throwing, but the caller must be able to retry later.
    await expect(service.notifyVerificationPendingModeration(params)).resolves.toBe(false);
  });

  it('tells the producer their verification passed, in their own language', async () => {
    await expect(
      service.notifyVerificationApproved({
        farmer: { email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
        farmName: 'Kakheti Farm',
      }),
    ).resolves.toBe(true);

    const sent = mail.send.mock.calls[0][0];
    expect(sent.to).toBe('farmer@example.com');
    expect(sent.subject).toContain('Верификация пройдена');
    expect(sent.text).toContain('Kakheti Farm');
    expect(sent.text).toContain('http://localhost:3000/ru/dashboard/farm');
  });

  it('translates the rejection reason and keeps the moderator comment verbatim', async () => {
    await service.notifyVerificationRejected({
      farmer: { email: 'farmer@example.com', locale: 'ru', displayName: 'Нино' },
      farmName: 'Kakheti Farm',
      reasonCode: 'documentRejected',
      moderatorComment: 'Scan is unreadable',
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.subject).toContain('Верификация отклонена');
    expect(sent.text).toContain('Модератор не принял документ для верификации.');
    expect(sent.text).toContain('Комментарий модератора: Scan is unreadable');
    // Internal wording must never reach the producer.
    expect(sent.text).not.toContain('documentRejected');
    expect(sent.text).not.toContain('Verification document rejected');
  });

  it('omits the comment block when a rejection has no moderator comment', async () => {
    await service.notifyVerificationRejected({
      farmer: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
      farmName: 'Kakheti Farm',
      reasonCode: 'registryNotConfirmed',
      moderatorComment: null,
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.text).toContain('The company registration could not be confirmed.');
    expect(sent.text).not.toContain('Moderator comment');
  });

  it('falls back to English for an unknown locale and an unknown reason', async () => {
    await service.notifyVerificationRejected({
      farmer: { email: 'farmer@example.com', locale: 'pt', displayName: 'Farmer' },
      farmName: 'Kakheti Farm',
      reasonCode: null,
      moderatorComment: null,
    });

    const sent = mail.send.mock.calls[0][0];
    expect(sent.subject).toBe('Verification not approved: Kakheti Farm');
    expect(sent.text).toContain('The verification requirements were not met.');
  });

  it('reports a failed decision email instead of throwing', async () => {
    mail.send.mockRejectedValueOnce(new Error('resend unavailable'));

    await expect(
      service.notifyVerificationApproved({
        farmer: { email: 'farmer@example.com', locale: 'en', displayName: 'Farmer' },
        farmName: 'Kakheti Farm',
      }),
    ).resolves.toBe(false);
  });

  it('builds password-reset links from WEB_PUBLIC_URL, not the request host', async () => {
    await service.notifyPasswordReset({
      email: 'farmer@example.com',
      locale: 'ka',
      displayName: 'Nino',
      rawToken: 'opaque-reset-token',
      expiresMinutes: 30,
    });

    const text = mail.send.mock.calls[0][0].text as string;
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'farmer@example.com',
        subject: expect.stringContaining('AgroBridge'),
      }),
    );
    expect(text).toContain(
      'http://localhost:3000/ka/reset-password?token=opaque-reset-token',
    );
    expect(text).toContain('30');
    expect(text).not.toContain('evil.example');
  });
});
