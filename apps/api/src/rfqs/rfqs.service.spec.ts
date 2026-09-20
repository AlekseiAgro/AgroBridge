import { BadRequestException, NotFoundException } from '@nestjs/common';
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
      count: jest.fn(),
      delete: jest.fn(),
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

  it('rejects RFQ for own product', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Hazelnuts',
      ownerUserId: farmer.id,
      farmId: null,
      unit: 'kg',
      isPublished: true,
      moderationStatus: 'approved',
      owner: {
        id: farmer.id,
        email: farmer.email,
        locale: farmer.locale,
        displayName: farmer.displayName,
      },
      farm: null,
    });

    await expect(
      service.create(farmer, { productId: 'p1', quantity: '100' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an RFQ for a published approved product with a real title', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Hazelnuts',
      ownerUserId: farmer.id,
      farmId: 'f1',
      unit: 'kg',
      isPublished: true,
      moderationStatus: 'approved',
      owner: {
        id: farmer.id,
        email: farmer.email,
        locale: farmer.locale,
        displayName: farmer.displayName,
      },
      farm: { id: 'f1', name: 'Farm' },
    });
    prisma.rfq.create.mockResolvedValue({
      id: 'rfq1',
      buyerId: buyer.id,
      status: 'pending',
      quantity: '100',
      unit: 'kg',
      message: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      product: {
        id: 'p1',
        title: 'Hazelnuts',
        ownerUserId: farmer.id,
        owner: {
          id: farmer.id,
          email: farmer.email,
          locale: farmer.locale,
          displayName: farmer.displayName,
        },
      },
      farm: { id: 'f1', name: 'Farm', region: null, ownerId: farmer.id },
      buyer: {
        id: buyer.id,
        displayName: buyer.displayName,
        email: buyer.email,
        locale: buyer.locale,
      },
      offer: null,
      ratings: [],
    });

    const result = await service.create(buyer, { productId: 'p1', quantity: '100' });
    expect(result.id).toBe('rfq1');
    expect(result.product.title).toBe('Hazelnuts');
    expect(prisma.rfq.create).toHaveBeenCalledTimes(1);
    expect(notifications.notifyRfqCreated).toHaveBeenCalledWith(
      expect.objectContaining({ productTitle: 'Hazelnuts', rfqId: 'rfq1' }),
    );
  });

  it('rejects RFQ for unpublished product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.create(buyer, { productId: 'missing', quantity: '100' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.rfq.create).not.toHaveBeenCalled();
  });

  it('rejects RFQ for a published draft title and does not create a row', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Новый товар',
      ownerUserId: farmer.id,
      farmId: null,
      unit: 'kg',
      isPublished: true,
      moderationStatus: 'approved',
      owner: {
        id: farmer.id,
        email: farmer.email,
        locale: farmer.locale,
        displayName: farmer.displayName,
      },
      farm: null,
    });

    await expect(
      service.create(buyer, { productId: 'p1', quantity: '100' }),
    ).rejects.toMatchObject({ message: 'Product not found' });
    expect(prisma.rfq.create).not.toHaveBeenCalled();
    expect(notifications.notifyRfqCreated).not.toHaveBeenCalled();
  });

  it('rejects RFQ for a hidden draft product', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Hazelnuts',
      ownerUserId: farmer.id,
      farmId: null,
      unit: 'kg',
      isPublished: false,
      moderationStatus: 'draft',
      owner: {
        id: farmer.id,
        email: farmer.email,
        locale: farmer.locale,
        displayName: farmer.displayName,
      },
      farm: null,
    });

    await expect(
      service.create(buyer, { productId: 'p1', quantity: '100' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.rfq.create).not.toHaveBeenCalled();
  });

  it('rejects accepting when no offer exists', async () => {
    prisma.rfq.findUnique.mockResolvedValue({
      id: 'rfq1',
      buyerId: buyer.id,
      status: 'pending',
      offer: null,
      product: {
        id: 'p1',
        title: 'Hazelnuts',
        ownerUserId: farmer.id,
        owner: {
          id: farmer.id,
          email: farmer.email,
          locale: farmer.locale,
          displayName: farmer.displayName,
        },
      },
      farm: {
        id: 'f1',
        name: 'Farm',
        region: null,
        ownerId: farmer.id,
      },
      buyer: {
        id: buyer.id,
        displayName: 'Buyer',
        email: buyer.email,
        locale: buyer.locale,
      },
      ratings: [],
      quantity: '100',
      unit: 'kg',
      message: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });

    await expect(service.accept(buyer, 'rfq1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts pending inbox RFQs for the farmer', async () => {
    prisma.rfq.count.mockResolvedValue(3);

    await expect(service.pendingInboxCount(farmer)).resolves.toEqual({ count: 3 });
    expect(prisma.rfq.count).toHaveBeenCalledWith({
      where: {
        product: { ownerUserId: farmer.id },
        status: 'pending',
      },
    });
  });

  it('lists completed deals for buyer or seller', async () => {
    prisma.rfq.findMany.mockResolvedValue([]);
    await expect(service.listCompleted(farmer)).resolves.toEqual([]);
    expect(prisma.rfq.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'completed',
          OR: [{ buyerId: farmer.id }, { product: { ownerUserId: farmer.id } }],
        },
      }),
    );
  });

  it('deletes cancelled inbox RFQs for the seller', async () => {
    prisma.rfq.findUnique.mockResolvedValue({
      id: 'rfq1',
      buyerId: buyer.id,
      status: 'cancelled',
      product: {
        id: 'p1',
        title: 'Hazelnuts',
        ownerUserId: farmer.id,
        owner: {
          id: farmer.id,
          email: farmer.email,
          locale: farmer.locale,
          displayName: farmer.displayName,
        },
      },
      farm: null,
      buyer: {
        id: buyer.id,
        displayName: 'Buyer',
        email: buyer.email,
        locale: buyer.locale,
      },
      offer: null,
      ratings: [],
      quantity: '100',
      unit: 'kg',
      message: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });
    prisma.rfq.delete.mockResolvedValue({});

    await expect(service.removeFromInbox(farmer, 'rfq1')).resolves.toEqual({ ok: true });
    expect(prisma.rfq.delete).toHaveBeenCalledWith({ where: { id: 'rfq1' } });
  });

  it('rejects deleting non-cancelled inbox RFQs', async () => {
    prisma.rfq.findUnique.mockResolvedValue({
      id: 'rfq1',
      buyerId: buyer.id,
      status: 'pending',
      product: {
        id: 'p1',
        title: 'Hazelnuts',
        ownerUserId: farmer.id,
        owner: {
          id: farmer.id,
          email: farmer.email,
          locale: farmer.locale,
          displayName: farmer.displayName,
        },
      },
      farm: null,
      buyer: {
        id: buyer.id,
        displayName: 'Buyer',
        email: buyer.email,
        locale: buyer.locale,
      },
      offer: null,
      ratings: [],
      quantity: '100',
      unit: 'kg',
      message: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });

    await expect(service.removeFromInbox(farmer, 'rfq1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.rfq.delete).not.toHaveBeenCalled();
  });
});
