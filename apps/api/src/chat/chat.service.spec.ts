import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const prisma = {
    rfq: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    conversation: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };

  const translationService = {
    translateMessage: jest.fn(),
  };

  let service: ChatService;

  const buyer = {
    id: 'buyer1',
    email: 'buyer@example.com',
    role: 'buyer' as const,
    locale: 'en' as const,
    displayName: 'Buyer',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService(prisma as never, translationService as never);
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
});
