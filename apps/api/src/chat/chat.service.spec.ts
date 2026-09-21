import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const prisma = {
    rfq: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    conversation: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
    },
    purchaseRequest: { findUnique: jest.fn() },
  };

  const notifications = {
    notifyChatMessage: jest.fn().mockResolvedValue(undefined),
  };

  let service: ChatService;

  const buyer = {
    id: 'buyer1',
    email: 'buyer@example.com',
    role: 'buyer' as const,
    sellerType: null,
    buyerType: 'individual' as const,
    locale: 'en' as const,
    displayName: 'Buyer',
    avatarUrl: null,
    emailVerified: true,
  };

  const farmer = {
    id: 'farmer1',
    email: 'farmer@example.com',
    role: 'farmer' as const,
    sellerType: 'privateFarmer' as const,
    buyerType: null,
    locale: 'ru' as const,
    displayName: 'Farmer',
    avatarUrl: null,
    emailVerified: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(
      prisma as never,
      notifications as never,
    );
  });

  it('requires rfqId or farmerId', async () => {
    await expect(service.createOrGet(buyer, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids opening RFQ chat for outsiders', async () => {
    prisma.rfq.findUnique.mockResolvedValue({
      id: 'rfq1',
      buyerId: 'other-buyer',
      product: { ownerUserId: 'other-farmer' },
    });

    await expect(
      service.createOrGet(buyer, { rfqId: 'rfq1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listMine sorts by last message time, newest first', async () => {
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'old',
        farmerId: farmer.id,
        buyerId: buyer.id,
        farmerLastReadAt: null,
        buyerLastReadAt: null,
        farmerLastDeliveredAt: null,
        buyerLastDeliveredAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-08-04T12:00:00Z'), // recently touched by read cursor
        farmer: { id: farmer.id, displayName: 'Farmer', role: 'farmer', locale: 'ru', avatarUrl: null },
        buyer: { id: buyer.id, displayName: 'Buyer', role: 'buyer', locale: 'en', avatarUrl: null },
        messages: [
          {
            id: 'm-old',
            conversationId: 'old',
            senderId: buyer.id,
            sourceLocale: 'en',
            sourceText: 'old',
            createdAt: new Date('2026-01-02'),
            translations: [],
          },
        ],
      },
      {
        id: 'new',
        farmerId: farmer.id,
        buyerId: 'buyer2',
        farmerLastReadAt: null,
        buyerLastReadAt: null,
        farmerLastDeliveredAt: null,
        buyerLastDeliveredAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-03'),
        farmer: { id: farmer.id, displayName: 'Farmer', role: 'farmer', locale: 'ru', avatarUrl: null },
        buyer: { id: 'buyer2', displayName: 'Gabriel', role: 'buyer', locale: 'en', avatarUrl: null },
        messages: [
          {
            id: 'm-new',
            conversationId: 'new',
            senderId: farmer.id,
            sourceLocale: 'ru',
            sourceText: 'new',
            createdAt: new Date('2026-08-04T11:00:00Z'),
            translations: [],
          },
        ],
      },
      {
        id: 'empty',
        farmerId: farmer.id,
        buyerId: 'buyer3',
        farmerLastReadAt: null,
        buyerLastReadAt: null,
        farmerLastDeliveredAt: null,
        buyerLastDeliveredAt: null,
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-08-04T13:00:00Z'),
        farmer: { id: farmer.id, displayName: 'Farmer', role: 'farmer', locale: 'ru', avatarUrl: null },
        buyer: { id: 'buyer3', displayName: 'Sophie', role: 'buyer', locale: 'en', avatarUrl: null },
        messages: [],
      },
    ]);
    prisma.message.findMany.mockResolvedValue([]);

    const items = await service.listMine(farmer);

    expect(items.map((item) => item.id)).toEqual(['new', 'empty', 'old']);
  });

  it('passes opener locale into createOrGet → getById', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: farmer.id,
      role: 'farmer',
    });
    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      farmerId: farmer.id,
      buyerId: buyer.id,
    });
    prisma.user.update.mockResolvedValue({});
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      farmerId: farmer.id,
      buyerId: buyer.id,
      farmerLastReadAt: null,
      buyerLastReadAt: null,
      farmerLastDeliveredAt: null,
      buyerLastDeliveredAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      farmer: { id: farmer.id, displayName: 'Farmer', role: 'farmer', locale: 'ru', avatarUrl: null },
      buyer: { id: buyer.id, displayName: 'Buyer', role: 'buyer', locale: 'en', avatarUrl: null },
    });
    prisma.conversation.update.mockResolvedValue({});
    prisma.message.findMany.mockResolvedValue([]);

    const detail = await service.createOrGet(buyer, {
      farmerId: farmer.id,
      locale: 'de',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: buyer.id },
      data: { locale: 'de' },
    });
    expect(detail.id).toBe('conv1');
    expect(detail.messages).toEqual([]);
  });

  describe('message views', () => {
    function conversationFixture() {
      return {
        id: 'conv1',
        farmerId: farmer.id,
        buyerId: buyer.id,
        farmerLastReadAt: null,
        buyerLastReadAt: null,
        farmerLastDeliveredAt: null,
        buyerLastDeliveredAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        farmer: {
          id: farmer.id,
          displayName: 'Farmer',
          role: 'farmer',
          locale: 'ru',
          avatarUrl: null,
        },
        buyer: {
          id: buyer.id,
          displayName: 'Buyer',
          role: 'buyer',
          locale: 'en',
          avatarUrl: null,
        },
      };
    }

    it('getById returns original source text without AI translation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationFixture());
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          conversationId: 'conv1',
          senderId: buyer.id,
          sourceLocale: 'en',
          sourceText: 'Hello',
          createdAt: new Date('2026-01-02'),
          translations: [
            {
              targetLocale: 'ru',
              translatedText: '[en→ru] Hello',
              status: 'completed',
            },
          ],
        },
      ]);

      const detail = await service.getById(farmer, 'conv1', 'ru');

      expect(detail.messages).toHaveLength(1);
      expect(detail.messages[0]).toMatchObject({
        isMine: false,
        sourceText: 'Hello',
        displayText: 'Hello',
        translationStatus: 'none',
        canShowOriginal: false,
        deliveryStatus: null,
      });
    });

    it('detects Georgian script for sourceLocale metadata', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationFixture());
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          conversationId: 'conv1',
          senderId: buyer.id,
          sourceLocale: 'ru',
          sourceText: 'გამარჯობა',
          createdAt: new Date('2026-01-02'),
          translations: [],
        },
      ]);

      const detail = await service.getById(farmer, 'conv1', 'ru');

      expect(detail.messages[0]).toMatchObject({
        sourceLocale: 'ka',
        displayText: 'გამარჯობა',
        canShowOriginal: false,
        deliveryStatus: null,
      });
    });

    it('marks own messages read when peer read cursor covers them', async () => {
      const fixture = conversationFixture();
      fixture.buyerLastReadAt = new Date('2026-01-03');
      fixture.buyerLastDeliveredAt = new Date('2026-01-03');
      prisma.conversation.findUnique.mockResolvedValue(fixture);
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          conversationId: 'conv1',
          senderId: farmer.id,
          sourceLocale: 'ru',
          sourceText: 'Цена',
          createdAt: new Date('2026-01-02'),
          translations: [],
        },
      ]);

      const detail = await service.getById(farmer, 'conv1', 'ru');

      expect(detail.messages[0]).toMatchObject({
        isMine: true,
        deliveryStatus: 'read',
      });
    });

    it('sendMessage stores source text without translating', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationFixture());
      prisma.message.create.mockResolvedValue({
        id: 'm2',
        conversationId: 'conv1',
        senderId: buyer.id,
        sourceLocale: 'en',
        sourceText: 'Offer?',
        createdAt: new Date('2026-01-03'),
      });
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findUniqueOrThrow.mockResolvedValue({
        id: 'm2',
        conversationId: 'conv1',
        senderId: buyer.id,
        sourceLocale: 'en',
        sourceText: 'Offer?',
        createdAt: new Date('2026-01-03'),
        translations: [],
      });

      const view = await service.sendMessage(buyer, 'conv1', {
        text: 'Offer?',
        sourceLocale: 'en',
      });

      expect(view).toMatchObject({
        isMine: true,
        displayText: 'Offer?',
        translationStatus: 'none',
        canShowOriginal: false,
        deliveryStatus: 'sent',
      });
    });
  });

  it('lets the supplier open chat on a fulfilled purchase request', async () => {
    prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: 'pr1',
      buyerId: buyer.id,
      status: 'fulfilled',
      quotes: [{ status: 'accepted', farm: { ownerId: farmer.id } }],
    });
    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      farmerId: farmer.id,
      buyerId: buyer.id,
    });
    prisma.user.update.mockResolvedValue({});
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      farmerId: farmer.id,
      buyerId: buyer.id,
      farmerLastReadAt: null,
      buyerLastReadAt: null,
      farmerLastDeliveredAt: null,
      buyerLastDeliveredAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      farmer: { id: farmer.id, displayName: 'Farmer', role: 'farmer', locale: 'ru', avatarUrl: null },
      buyer: { id: buyer.id, displayName: 'Buyer', role: 'buyer', locale: 'en', avatarUrl: null },
    });
    prisma.conversation.update.mockResolvedValue({});
    prisma.message.findMany.mockResolvedValue([]);

    const detail = await service.createOrGet(farmer, { purchaseRequestId: 'pr1' });
    expect(detail.id).toBe('conv1');
  });

  it('lets the buyer keep opening chat with the winning seller after acceptance', async () => {
    prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: 'pr1',
      buyerId: buyer.id,
      status: 'fulfilled',
      quotes: [{ status: 'accepted', farm: { ownerId: farmer.id } }],
    });
    prisma.user.findUnique.mockResolvedValue({ id: farmer.id, role: 'farmer' });
    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv1',
      farmerId: farmer.id,
      buyerId: buyer.id,
    });
    prisma.user.update.mockResolvedValue({});
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv1',
      farmerId: farmer.id,
      buyerId: buyer.id,
      farmerLastReadAt: null,
      buyerLastReadAt: null,
      farmerLastDeliveredAt: null,
      buyerLastDeliveredAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      farmer: { id: farmer.id, displayName: 'Farmer', role: 'farmer', locale: 'ru', avatarUrl: null },
      buyer: { id: buyer.id, displayName: 'Buyer', role: 'buyer', locale: 'en', avatarUrl: null },
    });
    prisma.conversation.update.mockResolvedValue({});
    prisma.message.findMany.mockResolvedValue([]);

    const detail = await service.createOrGet(buyer, {
      purchaseRequestId: 'pr1',
      farmerId: farmer.id,
    });
    expect(detail.id).toBe('conv1');
  });

  describe('purchase request chat authorization', () => {
    const outsider = {
      ...farmer,
      id: 'farmer-outsider',
      email: 'outsider@example.com',
      displayName: 'Outsider',
    };
    const otherBuyer = {
      ...buyer,
      id: 'buyer-other',
      email: 'other-buyer@example.com',
      displayName: 'Other Buyer',
    };

    function stubCreatedConversation() {
      prisma.conversation.upsert.mockResolvedValue({
        id: 'conv1',
        farmerId: farmer.id,
        buyerId: buyer.id,
      });
      prisma.user.update.mockResolvedValue({});
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv1',
        farmerId: farmer.id,
        buyerId: buyer.id,
        farmerLastReadAt: null,
        buyerLastReadAt: null,
        farmerLastDeliveredAt: null,
        buyerLastDeliveredAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        farmer: {
          id: farmer.id,
          displayName: 'Farmer',
          role: 'farmer',
          locale: 'ru',
          avatarUrl: null,
        },
        buyer: {
          id: buyer.id,
          displayName: 'Buyer',
          role: 'buyer',
          locale: 'en',
          avatarUrl: null,
        },
      });
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany.mockResolvedValue([]);
    }

    it('lets the purchase request owner open chat with a quoted seller', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'open',
        quotes: [{ status: 'pending', farm: { ownerId: farmer.id } }],
      });
      prisma.user.findUnique.mockResolvedValue({ id: farmer.id, role: 'farmer' });
      stubCreatedConversation();

      const detail = await service.createOrGet(buyer, {
        purchaseRequestId: 'pr1',
        farmerId: farmer.id,
      });

      expect(detail.id).toBe('conv1');
      expect(prisma.conversation.upsert).toHaveBeenCalledTimes(1);
    });

    it('lets a seller with a quote open chat with the buyer', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'open',
        quotes: [{ status: 'pending', farm: { ownerId: farmer.id } }],
      });
      stubCreatedConversation();

      const detail = await service.createOrGet(farmer, { purchaseRequestId: 'pr1' });

      expect(detail.id).toBe('conv1');
      expect(prisma.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { farmerId_buyerId: { farmerId: farmer.id, buyerId: buyer.id } },
        }),
      );
    });

    it('forbids an unrelated authenticated user from creating a purchase request chat', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'open',
        quotes: [{ status: 'pending', farm: { ownerId: farmer.id } }],
      });

      await expect(
        service.createOrGet(otherBuyer, { purchaseRequestId: 'pr1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });

    it('forbids a seller with no quote from creating the chat', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'open',
        quotes: [{ status: 'pending', farm: { ownerId: farmer.id } }],
      });

      await expect(
        service.createOrGet(outsider, { purchaseRequestId: 'pr1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });

    it('forbids the buyer from opening chat with a seller who never quoted', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'open',
        quotes: [{ status: 'pending', farm: { ownerId: farmer.id } }],
      });
      prisma.user.findUnique.mockResolvedValue({ id: outsider.id, role: 'farmer' });

      await expect(
        service.createOrGet(buyer, {
          purchaseRequestId: 'pr1',
          farmerId: outsider.id,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });

    it('does not create a chat for a nonexistent purchase request', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrGet(farmer, { purchaseRequestId: 'missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });

    it('returns the existing conversation when an authorized seller opens chat again', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'open',
        quotes: [{ status: 'pending', farm: { ownerId: farmer.id } }],
      });
      stubCreatedConversation();

      const first = await service.createOrGet(farmer, { purchaseRequestId: 'pr1' });
      const again = await service.createOrGet(farmer, { purchaseRequestId: 'pr1' });

      expect(first.id).toBe('conv1');
      expect(again.id).toBe('conv1');
      expect(prisma.conversation.upsert).toHaveBeenCalledTimes(2);
    });

    it('lets authorized participants keep sending messages after createOrGet', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'open',
        quotes: [{ status: 'pending', farm: { ownerId: farmer.id } }],
      });
      stubCreatedConversation();

      const detail = await service.createOrGet(farmer, { purchaseRequestId: 'pr1' });
      expect(detail.id).toBe('conv1');

      prisma.message.create.mockResolvedValue({
        id: 'm2',
        conversationId: 'conv1',
        senderId: farmer.id,
        sourceLocale: 'ru',
        sourceText: 'Цена',
        createdAt: new Date('2026-01-03'),
      });
      prisma.message.findUniqueOrThrow.mockResolvedValue({
        id: 'm2',
        conversationId: 'conv1',
        senderId: farmer.id,
        sourceLocale: 'ru',
        sourceText: 'Цена',
        createdAt: new Date('2026-01-03'),
        translations: [],
      });

      const view = await service.sendMessage(farmer, 'conv1', {
        text: 'Цена',
        sourceLocale: 'ru',
      });
      expect(view).toMatchObject({
        isMine: true,
        displayText: 'Цена',
        conversationId: 'conv1',
      });
    });

    it('forbids a declined seller from opening chat after the request is fulfilled', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'pr1',
        buyerId: buyer.id,
        status: 'fulfilled',
        quotes: [
          { status: 'accepted', farm: { ownerId: farmer.id } },
          { status: 'declined', farm: { ownerId: outsider.id } },
        ],
      });

      await expect(
        service.createOrGet(outsider, { purchaseRequestId: 'pr1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });
  });
});
