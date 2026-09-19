import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../mail/notifications.service';
import type { MailService } from '../mail/mail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { PurchaseRequestsService } from './purchase-requests.service';

/**
 * These tests drive the real NotificationsService down to MailService.send so a passing
 * suite means an email would actually leave the mail driver, not merely that a mock
 * notify*() method was invoked.
 */
describeWithDatabase()('purchase request mail dispatch (database)', () => {
  let prisma: PrismaClient;
  let service: PurchaseRequestsService;
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const createdUserIds: string[] = [];

  beforeAll(() => {
    prisma = createTestPrismaClient();
    const notifications = new NotificationsService(
      mail as unknown as MailService,
      {
        get: (key: string) => (key === 'WEB_PUBLIC_URL' ? 'http://localhost:3000' : undefined),
      } as ConfigService,
      prisma as unknown as PrismaService,
    );
    const subscriptions = new SubscriptionsService(
      prisma as unknown as PrismaService,
      notifications,
    );
    service = new PurchaseRequestsService(
      prisma as unknown as PrismaService,
      subscriptions,
      notifications,
    );
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const quoteDto = { priceAmount: '12.50', currency: 'USD' } as const;

  function asUser(user: {
    id: string;
    email: string;
    role: string;
    locale: string;
    displayName: string | null;
  }): AuthenticatedUser {
    return user as AuthenticatedUser;
  }

  function recipients(): string[] {
    return mail.send.mock.calls.map((call) => call[0].to as string);
  }

  function sentMatching(needle: string | RegExp) {
    return mail.send.mock.calls
      .map((call) => call[0])
      .filter((message) =>
        typeof needle === 'string'
          ? String(message.subject).includes(needle) || String(message.text).includes(needle)
          : needle.test(String(message.subject)) || needle.test(String(message.text)),
      );
  }

  async function createTrader(role: 'buyer' | 'farmer', locale: 'en' | 'ru' | 'ka' = 'en') {
    const user = await prisma.user.create({
      data: {
        email: `${role}-${randomUUID()}@example.test`,
        passwordHash: 'x',
        role,
        locale,
        displayName: `${role} ${createdUserIds.length}`,
      },
    });
    createdUserIds.push(user.id);
    return asUser(user);
  }

  async function createSupplier(locale: 'en' | 'ru' | 'ka' = 'en') {
    const user = await createTrader('farmer', locale);
    const farm = await prisma.farm.create({
      data: { ownerId: user.id, name: `Farm ${user.id.slice(-6)}` },
    });
    return { user, farmId: farm.id, farmName: farm.name };
  }

  it('emails opted-in suppliers when a purchase request is published, once each', async () => {
    const buyer = await createTrader('buyer');
    const matching = await createSupplier('ru');
    const otherCategory = await createSupplier();
    const optedOut = await createSupplier();
    const blocked = await createSupplier();

    await prisma.alertSubscription.create({
      data: { userId: matching.user.id, notifyPurchaseRequests: true },
    });
    await prisma.alertSubscription.create({
      data: {
        userId: otherCategory.user.id,
        notifyPurchaseRequests: true,
        allCategories: false,
        categories: ['nuts'],
      },
    });
    await prisma.alertSubscription.create({
      data: { userId: optedOut.user.id, notifyPurchaseRequests: false },
    });
    await prisma.user.update({
      where: { id: blocked.user.id },
      data: { blockedAt: new Date() },
    });
    await prisma.alertSubscription.create({
      data: { userId: blocked.user.id, notifyPurchaseRequests: true },
    });

    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });

    expect(recipients()).toEqual([matching.user.email]);
    expect(sentMatching('Новый запрос на покупку: Blueberries')).toHaveLength(1);
    expect(sentMatching(`/ru/requests/${created.id}`)).toHaveLength(1);
    expect(recipients()).not.toContain(buyer.email);
  });

  it('still publishes the request when the mail driver fails', async () => {
    const buyer = await createTrader('buyer');
    const subscriber = await createSupplier();
    await prisma.alertSubscription.create({
      data: { userId: subscriber.user.id, notifyPurchaseRequests: true },
    });
    mail.send.mockRejectedValueOnce(new Error('smtp down'));

    const created = await service.create(buyer, {
      title: 'Hazelnuts',
      category: 'nuts',
      quantity: '2t',
    });

    expect(created.id).toBeTruthy();
    expect(await prisma.purchaseRequest.findUnique({ where: { id: created.id } })).toMatchObject({
      status: 'open',
      title: 'Hazelnuts',
    });
  });

  it('emails the buyer exactly once when a supplier submits a quote', async () => {
    const buyer = await createTrader('buyer', 'en');
    const supplier = await createSupplier();
    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });
    mail.send.mockClear();

    await service.createQuote(supplier.user, created.id, quoteDto as never);

    expect(mail.send).toHaveBeenCalledTimes(1);
    const sent = mail.send.mock.calls[0][0];
    expect(sent.to).toBe(buyer.email);
    expect(sent.subject).toBe('New quote for Blueberries');
    expect(sent.text).toContain(supplier.farmName);
    expect(sent.text).toContain('12.50 USD');
  });

  it('emails the winner and each loser once when a quote is accepted', async () => {
    const buyer = await createTrader('buyer');
    const winner = await createSupplier('en');
    const loser = await createSupplier('ru');
    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });
    await service.createQuote(winner.user, created.id, quoteDto as never);
    await service.createQuote(loser.user, created.id, {
      priceAmount: '11.00',
      currency: 'USD',
    } as never);
    mail.send.mockClear();

    const quotes = await prisma.purchaseQuote.findMany({
      where: { requestId: created.id },
      orderBy: { priceAmount: 'desc' },
    });
    await service.acceptQuote(buyer, created.id, quotes[0].id);

    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(sentMatching('Your quote was accepted: Blueberries')).toHaveLength(1);
    expect(sentMatching('Ваше предложение не выбрано: «Blueberries»')).toHaveLength(1);
    expect(sentMatching(`/en/requests/${created.id}`)).toHaveLength(1);
    expect(recipients().sort()).toEqual([winner.user.email, loser.user.email].sort());
  });

  it('emails the supplier once when the buyer declines their quote', async () => {
    const buyer = await createTrader('buyer');
    const supplier = await createSupplier();
    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });
    await service.createQuote(supplier.user, created.id, quoteDto as never);
    const quote = await prisma.purchaseQuote.findFirstOrThrow({
      where: { requestId: created.id },
    });
    mail.send.mockClear();

    await service.declineQuote(buyer, created.id, quote.id);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe(supplier.user.email);
    expect(mail.send.mock.calls[0][0].subject).toBe('Your quote was not selected: Blueberries');
  });

  it('emails waiting suppliers the closed template, not the declined template', async () => {
    const buyer = await createTrader('buyer');
    const supplier = await createSupplier();
    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });
    await service.createQuote(supplier.user, created.id, quoteDto as never);
    mail.send.mockClear();

    await service.close(buyer, created.id);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe(supplier.user.email);
    expect(mail.send.mock.calls[0][0].subject).toBe('Purchase request closed: Blueberries');
    expect(mail.send.mock.calls[0][0].text).not.toContain('did not select');
  });

  it('emails waiting suppliers the cancelled template', async () => {
    const buyer = await createTrader('buyer');
    const supplier = await createSupplier();
    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });
    await service.createQuote(supplier.user, created.id, quoteDto as never);
    mail.send.mockClear();

    await service.cancel(buyer, created.id);

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].subject).toBe('Purchase request cancelled: Blueberries');
  });

  it('does not mail anyone when close is retried after success', async () => {
    const buyer = await createTrader('buyer');
    const supplier = await createSupplier();
    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });
    await service.createQuote(supplier.user, created.id, quoteDto as never);
    await service.close(buyer, created.id);
    mail.send.mockClear();

    await expect(service.close(buyer, created.id)).rejects.toBeDefined();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does not mail the buyer when a supplier withdraws a quote', async () => {
    const buyer = await createTrader('buyer');
    const supplier = await createSupplier();
    const created = await service.create(buyer, {
      title: 'Blueberries',
      category: 'berries',
      quantity: '1t',
    });
    await service.createQuote(supplier.user, created.id, quoteDto as never);
    const quote = await prisma.purchaseQuote.findFirstOrThrow({
      where: { requestId: created.id },
    });
    mail.send.mockClear();

    await service.withdrawQuote(supplier.user, created.id, quote.id);

    expect(mail.send).not.toHaveBeenCalled();
    expect(await prisma.purchaseQuote.findUniqueOrThrow({ where: { id: quote.id } })).toMatchObject(
      { status: 'withdrawn' },
    );
  });
});
