import { randomUUID } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ChatService } from '../chat/chat.service';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestPrismaClient, describeWithDatabase } from '../test-support/database';
import { PurchaseRequestsService } from './purchase-requests.service';

describeWithDatabase()('purchase request post-acceptance access (database)', () => {
  let prisma: PrismaClient;
  let service: PurchaseRequestsService;
  let chat: ChatService;
  const createdUserIds: string[] = [];

  const notifications = {
    notifyPurchaseQuoteReceived: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseQuoteAccepted: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseQuoteDeclined: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseRequestWithdrawn: jest.fn().mockResolvedValue(undefined),
    notifyChatMessage: jest.fn().mockResolvedValue(undefined),
  };
  const subscriptions = { notifyNewPurchaseRequest: jest.fn().mockResolvedValue(undefined) };

  beforeAll(() => {
    prisma = createTestPrismaClient();
    service = new PurchaseRequestsService(
      prisma as unknown as PrismaService,
      subscriptions as never,
      notifications as never,
    );
    chat = new ChatService(prisma as unknown as PrismaService, notifications as never);
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

  async function createTrader(role: 'buyer' | 'farmer' | 'admin'): Promise<AuthenticatedUser> {
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

  async function createSupplier() {
    const user = await createTrader('farmer');
    const farm = await prisma.farm.create({
      data: { ownerId: user.id, name: `Farm ${user.id.slice(-6)}` },
    });
    return { user, farmId: farm.id };
  }

  async function acceptQuoteScenario() {
    const buyer = await createTrader('buyer');
    const winner = await createSupplier();
    const loser = await createSupplier();
    const stranger = await createTrader('buyer');
    const admin = await createTrader('admin');

    const created = await service.create(buyer, {
      title: `Blueberries ${randomUUID().slice(0, 8)}`,
      category: 'berries',
      quantity: '1t',
    } as never);
    await service.createQuote(winner.user, created.id, {
      priceAmount: '12.50',
      currency: 'USD',
    } as never);
    await service.createQuote(loser.user, created.id, {
      priceAmount: '11.00',
      currency: 'USD',
    } as never);

    const beforeChat = await chat.createOrGet(winner.user, {
      purchaseRequestId: created.id,
    });

    const quotes = await prisma.purchaseQuote.findMany({
      where: { requestId: created.id },
      include: { farm: { select: { ownerId: true } } },
    });
    const winningQuote = quotes.find((quote) => quote.farm.ownerId === winner.user.id);
    if (!winningQuote) {
      throw new Error('expected winning quote');
    }

    await service.acceptQuote(buyer, created.id, winningQuote.id);
    return {
      buyer,
      winner: winner.user,
      loser: loser.user,
      stranger,
      admin,
      requestId: created.id,
      conversationId: beforeChat.id,
    };
  }

  it('keeps the fulfilled request readable for buyer, winner, and admin only', async () => {
    const { buyer, winner, loser, stranger, admin, requestId } = await acceptQuoteScenario();

    const buyerView = await service.getById(buyer, requestId);
    expect(buyerView.status).toBe('fulfilled');
    expect(buyerView.quotes.some((quote) => quote.status === 'accepted')).toBe(true);

    const winnerView = await service.getById(winner, requestId);
    expect(winnerView.status).toBe('fulfilled');
    expect(winnerView.myQuote?.status).toBe('accepted');
    expect(winnerView.canMessageBuyer).toBe(true);
    expect(winnerView.canQuote).toBe(false);

    await expect(service.getById(loser, requestId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getById(stranger, requestId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getById(null, requestId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getById(admin, requestId)).resolves.toMatchObject({
      id: requestId,
      status: 'fulfilled',
    });
  });

  it('lists the fulfilled request for the buyer only; sellers find it in My Quotes', async () => {
    const { buyer, winner, loser, stranger, requestId } = await acceptQuoteScenario();

    const buyerMine = await service.listMine(buyer);
    expect(buyerMine.map((item) => item.id)).toContain(requestId);

    const winnerMine = await service.listMine(winner);
    expect(winnerMine.map((item) => item.id)).not.toContain(requestId);

    const winnerQuotes = await service.listMyQuotes(winner);
    expect(winnerQuotes.map((item) => item.request.id)).toContain(requestId);
    expect(winnerQuotes.find((item) => item.request.id === requestId)).toMatchObject({
      status: 'accepted',
      canOpenRequest: true,
    });

    const loserMine = await service.listMine(loser);
    expect(loserMine.map((item) => item.id)).not.toContain(requestId);

    const loserQuotes = await service.listMyQuotes(loser);
    expect(loserQuotes.map((item) => item.request.id)).toContain(requestId);
    expect(loserQuotes.find((item) => item.request.id === requestId)).toMatchObject({
      status: 'declined',
      canOpenRequest: false,
    });

    const strangerMine = await service.listMine(stranger);
    expect(strangerMine.map((item) => item.id)).not.toContain(requestId);
    expect(await service.listMyQuotes(stranger)).toEqual([]);

    const board = await service.listOpen({}, winner);
    expect(board.map((item) => item.id)).not.toContain(requestId);
  });

  it('keeps the existing chat and lets both parties open it after acceptance', async () => {
    const { buyer, winner, requestId, conversationId } = await acceptQuoteScenario();

    const listed = await chat.listMine(winner);
    expect(listed.map((item) => item.id)).toContain(conversationId);

    const again = await chat.createOrGet(winner, { purchaseRequestId: requestId });
    expect(again.id).toBe(conversationId);

    const buyerChat = await chat.createOrGet(buyer, {
      purchaseRequestId: requestId,
      farmerId: winner.id,
    });
    expect(buyerChat.id).toBe(conversationId);
  });

  it('points the acceptance notification at the request the winner can open', async () => {
    const { winner, requestId } = await acceptQuoteScenario();

    expect(notifications.notifyPurchaseQuoteAccepted).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        farmer: expect.objectContaining({ email: winner.email }),
      }),
    );
  });
});
