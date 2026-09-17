import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { PurchaseRequestsService } from './purchase-requests.service';

/**
 * "One purchase request awards at most one quote" is enforced by a conditional UPDATE and
 * Postgres row locking. A mocked client cannot contradict itself the way two real sessions
 * can, so the guarantee is only worth anything when two transactions actually race.
 */
describeWithDatabase()('purchase request quote acceptance (database)', () => {
  let prisma: PrismaClient;
  let service: PurchaseRequestsService;

  const notifications = {
    notifyPurchaseQuoteReceived: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseQuoteAccepted: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseQuoteDeclined: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseRequestWithdrawn: jest.fn().mockResolvedValue(undefined),
  };
  const subscriptions = { notifyNewPurchaseRequest: jest.fn().mockResolvedValue(undefined) };

  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    service = new PurchaseRequestsService(
      prisma as unknown as PrismaService,
      subscriptions as never,
      notifications as never,
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

  async function createTrader(role: 'buyer' | 'farmer'): Promise<AuthenticatedUser> {
    const user = await prisma.user.create({
      data: {
        email: `${role}-${randomUUID()}@example.test`,
        passwordHash: 'x',
        role,
        locale: 'en',
        displayName: `${role} ${createdUserIds.length}`,
      },
    });
    createdUserIds.push(user.id);
    return {
      id: user.id,
      email: user.email,
      role,
      locale: 'en',
      displayName: user.displayName,
    } as AuthenticatedUser;
  }

  async function createSupplier(): Promise<{ user: AuthenticatedUser; farmId: string }> {
    const user = await createTrader('farmer');
    const farm = await prisma.farm.create({
      data: { ownerId: user.id, name: `Farm ${user.id.slice(-6)}` },
    });
    return { user, farmId: farm.id };
  }

  /** An open request carrying `count` pending quotes from distinct farms. */
  async function openRequestWithQuotes(count: number) {
    const buyer = await createTrader('buyer');
    const request = await prisma.purchaseRequest.create({
      data: {
        buyerId: buyer.id,
        title: `Blueberries ${randomUUID().slice(0, 8)}`,
        category: 'berries',
        quantity: '1t',
        status: 'open',
      },
    });

    const quotes: { id: string; farmId: string }[] = [];
    for (let index = 0; index < count; index += 1) {
      const supplier = await createSupplier();
      const quote = await prisma.purchaseQuote.create({
        data: {
          requestId: request.id,
          farmId: supplier.farmId,
          priceAmount: 10 + index,
          currency: 'USD',
          status: 'pending',
        },
      });
      quotes.push({ id: quote.id, farmId: supplier.farmId });
    }

    return { buyer, requestId: request.id, quotes };
  }

  async function finalState(requestId: string) {
    const [request, quotes] = await Promise.all([
      prisma.purchaseRequest.findUniqueOrThrow({ where: { id: requestId } }),
      prisma.purchaseQuote.findMany({ where: { requestId } }),
    ]);
    return {
      status: request.status,
      accepted: quotes.filter((quote) => quote.status === 'accepted').length,
      declined: quotes.filter((quote) => quote.status === 'declined').length,
      pending: quotes.filter((quote) => quote.status === 'pending').length,
    };
  }

  it('awards exactly one quote when two acceptances race', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(2);

    const outcomes = await Promise.allSettled([
      service.acceptQuote(buyer, requestId, quotes[0].id),
      service.acceptQuote(buyer, requestId, quotes[1].id),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled');
    const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // A controlled 409, not a deadlock or a unique-constraint crash.
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ConflictException);
    expect((reason as ConflictException).getStatus()).toBe(409);

    expect(await finalState(requestId)).toEqual({
      status: 'fulfilled',
      accepted: 1,
      declined: 1,
      pending: 0,
    });
  });

  it('holds the invariant when five acceptances race at once', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(5);

    const outcomes = await Promise.allSettled(
      quotes.map((quote) => service.acceptQuote(buyer, requestId, quote.id)),
    );

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    for (const outcome of outcomes.filter((item) => item.status === 'rejected')) {
      expect((outcome as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    }
    expect(await finalState(requestId)).toEqual({
      status: 'fulfilled',
      accepted: 1,
      declined: 4,
      pending: 0,
    });
  });

  it('tells the winner once and the losers once, however many callers tried', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(3);

    await Promise.allSettled(
      quotes.map((quote) => service.acceptQuote(buyer, requestId, quote.id)),
    );

    expect(notifications.notifyPurchaseQuoteAccepted).toHaveBeenCalledTimes(1);
    expect(notifications.notifyPurchaseQuoteDeclined).toHaveBeenCalledTimes(2);
  });

  it('rejects a retry of an acceptance that already happened', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(2);

    await service.acceptQuote(buyer, requestId, quotes[0].id);
    notifications.notifyPurchaseQuoteAccepted.mockClear();

    // `requireOwnedOpen` catches the sequential replay before the transaction; either way
    // the point is that no second award and no second email happen.
    await expect(service.acceptQuote(buyer, requestId, quotes[1].id)).rejects.toBeDefined();
    expect(notifications.notifyPurchaseQuoteAccepted).not.toHaveBeenCalled();
    expect(await finalState(requestId)).toMatchObject({ status: 'fulfilled', accepted: 1 });
  });

  it('leaves the request open when the only quote is withdrawn mid-flight', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(1);

    // The service has already read a pending quote; the supplier withdraws before the
    // transaction opens. Only the conditional update inside it can still notice.
    const realTransaction = prisma.$transaction.bind(prisma);
    const hook = jest
      .spyOn(prisma, '$transaction')
      .mockImplementation(async (...args: Parameters<typeof realTransaction>) => {
        await prisma.purchaseQuote.update({
          where: { id: quotes[0].id },
          data: { status: 'withdrawn' },
        });
        hook.mockRestore();
        return realTransaction(...args);
      });

    await expect(service.acceptQuote(buyer, requestId, quotes[0].id)).rejects.toBeInstanceOf(
      ConflictException,
    );

    // The whole transaction rolled back: no request fulfilled without a winner.
    expect(await finalState(requestId)).toMatchObject({ status: 'open', accepted: 0 });
    expect(notifications.notifyPurchaseQuoteAccepted).not.toHaveBeenCalled();
  });

  it('does not close a request twice when the buyer double-clicks', async () => {
    const { buyer, requestId } = await openRequestWithQuotes(2);

    const outcomes = await Promise.allSettled([
      service.close(buyer, requestId),
      service.close(buyer, requestId),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    // Two suppliers, told once each — not twice.
    expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(2);
    expect(await finalState(requestId)).toEqual({
      status: 'closed',
      accepted: 0,
      declined: 2,
      pending: 0,
    });
  });

  it('accepts one quote and declines the rest on the ordinary single-threaded path', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(2);

    await service.acceptQuote(buyer, requestId, quotes[0].id);

    expect(await finalState(requestId)).toEqual({
      status: 'fulfilled',
      accepted: 1,
      declined: 1,
      pending: 0,
    });
  });

  it('refuses a second accept of the same quote after the request is fulfilled', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(1);

    await service.acceptQuote(buyer, requestId, quotes[0].id);
    await expect(service.acceptQuote(buyer, requestId, quotes[0].id)).rejects.toBeDefined();
    expect(await finalState(requestId)).toMatchObject({ status: 'fulfilled', accepted: 1 });
  });

  it('refuses acceptance after the buyer closed the request', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(1);

    await service.close(buyer, requestId);
    await expect(service.acceptQuote(buyer, requestId, quotes[0].id)).rejects.toBeDefined();
    expect(await finalState(requestId)).toEqual({
      status: 'closed',
      accepted: 0,
      declined: 1,
      pending: 0,
    });
  });

  it('refuses acceptance after the buyer cancelled the request', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(1);

    await service.cancel(buyer, requestId);
    await expect(service.acceptQuote(buyer, requestId, quotes[0].id)).rejects.toBeDefined();
    expect(await finalState(requestId)).toEqual({
      status: 'cancelled',
      accepted: 0,
      declined: 1,
      pending: 0,
    });
  });

  it('does not accept a quote that belongs to a different purchase request', async () => {
    const first = await openRequestWithQuotes(1);
    const second = await openRequestWithQuotes(1);

    await expect(
      service.acceptQuote(first.buyer, first.requestId, second.quotes[0].id),
    ).rejects.toBeDefined();

    expect(await finalState(first.requestId)).toMatchObject({
      status: 'open',
      accepted: 0,
      pending: 1,
    });
    expect(await finalState(second.requestId)).toMatchObject({
      status: 'open',
      accepted: 0,
      pending: 1,
    });
  });

  it('rejects a buyer who does not own the request', async () => {
    const { requestId, quotes } = await openRequestWithQuotes(1);
    const stranger = await createTrader('buyer');

    await expect(service.acceptQuote(stranger, requestId, quotes[0].id)).rejects.toBeDefined();
    expect(await finalState(requestId)).toMatchObject({ status: 'open', accepted: 0, pending: 1 });
  });

  it('declines every pending quote when the buyer closes the request', async () => {
    const { buyer, requestId } = await openRequestWithQuotes(2);

    await service.close(buyer, requestId);

    expect(await finalState(requestId)).toEqual({
      status: 'closed',
      accepted: 0,
      declined: 2,
      pending: 0,
    });
    expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(2);
  });

  it('declines every pending quote when the buyer cancels the request', async () => {
    const { buyer, requestId } = await openRequestWithQuotes(2);

    await service.cancel(buyer, requestId);

    expect(await finalState(requestId)).toEqual({
      status: 'cancelled',
      accepted: 0,
      declined: 2,
      pending: 0,
    });
    expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(2);
  });

  it('declines only pending quotes and leaves accepted, declined and withdrawn alone', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(4);
    await prisma.purchaseQuote.update({
      where: { id: quotes[1].id },
      data: { status: 'accepted' },
    });
    await prisma.purchaseQuote.update({
      where: { id: quotes[2].id },
      data: { status: 'declined' },
    });
    await prisma.purchaseQuote.update({
      where: { id: quotes[3].id },
      data: { status: 'withdrawn' },
    });

    await service.close(buyer, requestId);

    const rows = await prisma.purchaseQuote.findMany({
      where: { requestId },
      orderBy: { priceAmount: 'asc' },
    });
    expect(rows.map((row) => row.status)).toEqual([
      'declined',
      'accepted',
      'declined',
      'withdrawn',
    ]);
    expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(1);
  });

  it('does not mail again or rewrite quotes when close is retried after success', async () => {
    const { buyer, requestId } = await openRequestWithQuotes(2);

    await service.close(buyer, requestId);
    notifications.notifyPurchaseRequestWithdrawn.mockClear();

    await expect(service.close(buyer, requestId)).rejects.toBeDefined();
    expect(notifications.notifyPurchaseRequestWithdrawn).not.toHaveBeenCalled();
    expect(await finalState(requestId)).toEqual({
      status: 'closed',
      accepted: 0,
      declined: 2,
      pending: 0,
    });
  });

  it('rejects a buyer who does not own the request from closing or cancelling', async () => {
    const { requestId, quotes } = await openRequestWithQuotes(1);
    const stranger = await createTrader('buyer');
    const farm = await prisma.farm.findUniqueOrThrow({
      where: { id: quotes[0].farmId },
      include: { owner: true },
    });
    const supplier = {
      id: farm.ownerId,
      email: farm.owner.email,
      role: 'farmer' as const,
      locale: 'en',
      displayName: farm.owner.displayName,
    } as AuthenticatedUser;

    await expect(service.close(stranger, requestId)).rejects.toBeDefined();
    await expect(service.cancel(supplier, requestId)).rejects.toBeDefined();
    expect(await finalState(requestId)).toMatchObject({
      status: 'open',
      pending: 1,
      declined: 0,
    });
    expect(notifications.notifyPurchaseRequestWithdrawn).not.toHaveBeenCalled();
  });

  it('lets only one of a concurrent close and cancel win, and leaves no pending quotes', async () => {
    const { buyer, requestId } = await openRequestWithQuotes(2);

    const outcomes = await Promise.allSettled([
      service.close(buyer, requestId),
      service.cancel(buyer, requestId),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect((outcomes.find((item) => item.status === 'rejected') as PromiseRejectedResult).reason)
      .toBeInstanceOf(ConflictException);

    const state = await finalState(requestId);
    expect(['closed', 'cancelled']).toContain(state.status);
    expect(state).toMatchObject({ accepted: 0, declined: 2, pending: 0 });
    expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(2);
  });

  it('never leaves a pending quote when close races acceptQuote', async () => {
    const { buyer, requestId, quotes } = await openRequestWithQuotes(2);

    const outcomes = await Promise.allSettled([
      service.close(buyer, requestId),
      service.acceptQuote(buyer, requestId, quotes[0].id),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find((item) => item.status === 'rejected') as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(ConflictException);

    const state = await finalState(requestId);
    expect(state.pending).toBe(0);
    const awarded = await prisma.purchaseQuote.findUniqueOrThrow({ where: { id: quotes[0].id } });

    if (state.status === 'fulfilled') {
      expect(state).toEqual({ status: 'fulfilled', accepted: 1, declined: 1, pending: 0 });
      expect(awarded.status).toBe('accepted');
      expect(notifications.notifyPurchaseQuoteAccepted).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPurchaseRequestWithdrawn).not.toHaveBeenCalled();
    } else {
      expect(state).toEqual({ status: 'closed', accepted: 0, declined: 2, pending: 0 });
      expect(awarded.status).toBe('declined');
      expect(notifications.notifyPurchaseQuoteAccepted).not.toHaveBeenCalled();
      expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(2);
    }
  });
});
