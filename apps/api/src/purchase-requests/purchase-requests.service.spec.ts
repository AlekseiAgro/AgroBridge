import { ForbiddenException } from '@nestjs/common';
import { PurchaseRequestsService } from './purchase-requests.service';

describe('PurchaseRequestsService', () => {
  const prisma = {
    purchaseRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    purchaseQuote: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    farm: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new PurchaseRequestsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects farmers from creating purchase requests', async () => {
    await expect(
      service.create(
        {
          id: 'f1',
          email: 'farmer@example.com',
          role: 'farmer',
          locale: 'en',
          displayName: 'Farmer',
        },
        {
          title: 'Blueberries',
          category: 'berries',
          quantity: '1',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
