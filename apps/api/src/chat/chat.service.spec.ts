import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
});
