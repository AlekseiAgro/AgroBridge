import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RfqsService } from './rfqs.service';

describe('RfqsService', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    farm: { findUnique: jest.fn() },
    rfq: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    rfqOffer: { create: jest.fn() },
  };

  const notifications = {
    notifyRfqCreated: jest.fn().mockResolvedValue(undefined),
    notifyRfqOfferCreated: jest.fn().mockResolvedValue(undefined),
    notifyRfqAccepted: jest.fn().mockResolvedValue(undefined),
    notifyRfqDeclinedByBuyer: jest.fn().mockResolvedValue(undefined),
    notifyRfqDeclinedByFarmer: jest.fn().mockResolvedValue(undefined),
    notifyRfqCancelled: jest.fn().mockResolvedValue(undefined),
  };

  let service: RfqsService;

  const buyer = {
    id: 'buyer1',
    email: 'buyer@example.com',
    role: 'buyer' as const,
    locale: 'en' as const,
    displayName: 'Buyer',
  };

  const farmer = {
    id: 'farmer1',
    email: 'farmer@example.com',
    role: 'farmer' as const,
    locale: 'ka' as const,
    displayName: 'Farmer',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RfqsService(prisma as never, notifications as never);
  });

  it('rejects farmers from creating RFQs', async () => {
    await expect(
      service.create(farmer, { productId: 'p1', quantity: '100' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects RFQ for unpublished product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.create(buyer, { productId: 'missing', quantity: '100' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects accepting when no offer exists', async () => {
    prisma.rfq.findUnique.mockResolvedValue({
      id: 'rfq1',
      buyerId: buyer.id,
      status: 'pending',
      offer: null,
      product: { id: 'p1', title: 'Hazelnuts' },
      farm: {
        id: 'f1',
        name: 'Farm',
        region: null,
        ownerId: farmer.id,
        owner: {
          id: farmer.id,
          email: farmer.email,
          locale: farmer.locale,
          displayName: farmer.displayName,
        },
      },
      buyer: {
        id: buyer.id,
        displayName: 'Buyer',
        email: buyer.email,
        locale: buyer.locale,
      },
      quantity: '100',
      unit: 'kg',
      message: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.accept(buyer, 'rfq1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
