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
});
