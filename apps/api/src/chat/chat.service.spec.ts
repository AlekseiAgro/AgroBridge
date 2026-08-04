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
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
    },
    purchaseRequest: { findUnique: jest.fn() },
  };

  const translationService = {
    translateMessage: jest.fn(),
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
      translationService as never,
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
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      farmer: { id: farmer.id, displayName: 'Farmer', role: 'farmer', locale: 'ru' },
      buyer: { id: buyer.id, displayName: 'Buyer', role: 'buyer', locale: 'en' },
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

  describe('translation views', () => {
    function conversationFixture() {
      return {
        id: 'conv1',
        farmerId: farmer.id,
        buyerId: buyer.id,
        farmerLastReadAt: null,
        buyerLastReadAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        farmer: {
          id: farmer.id,
          displayName: 'Farmer',
          role: 'farmer',
          locale: 'ru',
        },
        buyer: {
          id: buyer.id,
          displayName: 'Buyer',
          role: 'buyer',
          locale: 'en',
        },
      };
    }

    it('getById backfills and shows completed translation for viewer UI locale', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationFixture());
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany
        .mockResolvedValueOnce([
          {
            id: 'm1',
            conversationId: 'conv1',
            senderId: buyer.id,
            sourceLocale: 'en',
            sourceText: 'Hello',
            createdAt: new Date('2026-01-02'),
            translations: [],
          },
        ])
        .mockResolvedValueOnce([
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
      translationService.translateMessage.mockResolvedValue({});

      const detail = await service.getById(farmer, 'conv1', 'ru');

      expect(translationService.translateMessage).toHaveBeenCalledWith({
        messageId: 'm1',
        sourceText: 'Hello',
        sourceLocale: 'en',
        targetLocale: 'ru',
      });
      expect(detail.messages).toHaveLength(1);
      expect(detail.messages[0]).toMatchObject({
        isMine: false,
        sourceLocale: 'en',
        sourceText: 'Hello',
        displayText: '[en→ru] Hello',
        translationStatus: 'completed',
        canShowOriginal: true,
      });
    });

    it('detects Georgian script even when sourceLocale was saved as ru', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationFixture());
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany
        .mockResolvedValueOnce([
          {
            id: 'm1',
            conversationId: 'conv1',
            senderId: buyer.id,
            sourceLocale: 'ru',
            sourceText: 'გამარჯობა',
            createdAt: new Date('2026-01-02'),
            translations: [],
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'm1',
            conversationId: 'conv1',
            senderId: buyer.id,
            sourceLocale: 'ru',
            sourceText: 'გამარჯობა',
            createdAt: new Date('2026-01-02'),
            translations: [
              {
                targetLocale: 'ru',
                translatedText: '[ka→ru] გამარჯობა',
                status: 'completed',
              },
            ],
          },
        ]);
      translationService.translateMessage.mockResolvedValue({});

      const detail = await service.getById(farmer, 'conv1', 'ru');

      expect(translationService.translateMessage).toHaveBeenCalledWith({
        messageId: 'm1',
        sourceText: 'გამარჯობა',
        sourceLocale: 'ka',
        targetLocale: 'ru',
      });
      expect(detail.messages[0]).toMatchObject({
        sourceLocale: 'ka',
        displayText: '[ka→ru] გამარჯობა',
        canShowOriginal: true,
      });
    });

    it('skips translation UI when sourceLocale matches viewer locale', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationFixture());
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          conversationId: 'conv1',
          senderId: buyer.id,
          sourceLocale: 'ru',
          sourceText: 'Привет',
          createdAt: new Date('2026-01-02'),
          translations: [],
        },
      ]);

      const detail = await service.getById(farmer, 'conv1', 'ru');

      expect(translationService.translateMessage).not.toHaveBeenCalled();
      expect(detail.messages[0]).toMatchObject({
        isMine: false,
        displayText: 'Привет',
        translationStatus: 'none',
        canShowOriginal: false,
      });
    });

    it('never marks own messages as translated (no Show original for sender)', async () => {
      prisma.conversation.findUnique.mockResolvedValue(conversationFixture());
      prisma.conversation.update.mockResolvedValue({});
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          conversationId: 'conv1',
          senderId: farmer.id,
          sourceLocale: 'ru',
          sourceText: 'Цена',
          createdAt: new Date('2026-01-02'),
          translations: [
            {
              targetLocale: 'en',
              translatedText: '[ru→en] Цена',
              status: 'completed',
            },
          ],
        },
      ]);

      const detail = await service.getById(farmer, 'conv1', 'ru');

      expect(detail.messages[0]).toMatchObject({
        isMine: true,
        displayText: 'Цена',
        translationStatus: 'none',
        canShowOriginal: false,
      });
    });

    it('sendMessage translates into peer DB locale using sourceLocale from UI', async () => {
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
      translationService.translateMessage.mockResolvedValue({});
      prisma.message.findUniqueOrThrow.mockResolvedValue({
        id: 'm2',
        conversationId: 'conv1',
        senderId: buyer.id,
        sourceLocale: 'en',
        sourceText: 'Offer?',
        createdAt: new Date('2026-01-03'),
        translations: [
          {
            targetLocale: 'ru',
            translatedText: '[en→ru] Offer?',
            status: 'completed',
          },
        ],
      });

      const view = await service.sendMessage(buyer, 'conv1', {
        text: 'Offer?',
        sourceLocale: 'en',
      });

      expect(translationService.translateMessage).toHaveBeenCalledWith({
        messageId: 'm2',
        sourceText: 'Offer?',
        sourceLocale: 'en',
        targetLocale: 'ru',
      });
      // Sender always sees their own original (toggle is peer-only).
      expect(view).toMatchObject({
        isMine: true,
        displayText: 'Offer?',
        translationStatus: 'none',
        canShowOriginal: false,
      });
    });
  });
});
