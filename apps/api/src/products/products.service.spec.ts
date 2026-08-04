import { BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const prisma = {
    farm: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productImage: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    harvestWatch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const ratings = {
    summaryForUser: jest.fn().mockResolvedValue({ average: null, count: 0 }),
    summariesForUsers: jest.fn().mockResolvedValue(new Map()),
  };

  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(
      prisma as never,
      storage as never,
      ratings as never,
      { enabledIds: jest.fn().mockResolvedValue(null) } as never,
      {
        notifyHarvestAvailable: jest.fn().mockResolvedValue(undefined),
        notifyHarvestPreorderOpen: jest.fn().mockResolvedValue(undefined),
        notifyProductPendingModeration: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
  });

  it('allows creating products without a farm profile', async () => {
    prisma.farm.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({
      id: 'p1',
      ownerUserId: 'u1',
      farmId: null,
      title: 'Hazelnuts',
      description: null,
      category: null,
      variety: null,
      country: 'Georgia',
      originPlace: null,
      unit: null,
      minQuantity: null,
      maxQuantity: null,
      currentStock: null,
      monthlyProduction: null,
      maxAnnualProduction: null,
      seasonMonths: [],
      harvestStartAt: null,
      harvestEndAt: null,
      forecastQuantity: null,
      harvestStatus: null,
      preorderEnabled: false,
      attributes: {},
      packagingTypes: [],
      packagingWeights: [],
      palletSize: null,
      incoterms: [],
      carriers: [],
      customDelivery: null,
      nearestPort: null,
      deliveryAvailable: false,
      leadTimeDays: null,
      priceFrom: null,
      priceCurrency: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: false,
      moderationStatus: 'draft',
      moderationNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 'u1', displayName: null },
      farm: null,
      images: [],
      videos: [],
      certificates: [],
    });

    const result = await service.create(
      {
        id: 'u1',
        email: 'f@example.com',
        role: 'farmer',
        locale: 'en',
        displayName: null,
      },
      { title: 'Hazelnuts' },
    );

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'u1',
          farmId: null,
          title: 'Hazelnuts',
        }),
      }),
    );
    expect(result.ownerUserId).toBe('u1');
    expect(result.farm).toBeNull();
  });

  it('allows buyers to manage products', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await expect(
      service.listMine({
        id: 'u2',
        email: 'b@example.com',
        role: 'buyer',
        locale: 'en',
        displayName: null,
      }),
    ).resolves.toEqual([]);

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerUserId: 'u2' },
      }),
    );
  });

  it('rejects unsupported image types', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      ownerUserId: 'u1',
      farm: null,
      isPublished: false,
      moderationStatus: 'draft',
    });

    await expect(
      service.addImage(
        {
          id: 'u1',
          email: 'f@example.com',
          role: 'farmer',
          locale: 'en',
          displayName: null,
          sellerType: null,
          buyerType: null,
        },
        'p1',
        {
          mimetype: 'image/gif',
          size: 1000,
          buffer: Buffer.from('x'),
          originalname: 'x.gif',
        } as Express.Multer.File,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('searches catalog by localized title via canonical title keys', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.catalog({ q: 'персики' });

    expect(prisma.product.findMany).toHaveBeenCalled();
    const arg = prisma.product.findMany.mock.calls[0][0] as {
      where: { AND: Array<{ OR?: Array<Record<string, unknown>> }> };
    };
    expect(arg.where.AND.some((clause) => Array.isArray(clause.OR))).toBe(true);
  });

  it('keeps approved published products live after content edits', async () => {
    const farmer = {
      id: 'u1',
      email: 'f@example.com',
      role: 'farmer' as const,
      locale: 'en' as const,
      displayName: null,
      sellerType: null,
      buyerType: null,
    };
    const existing = {
      id: 'p1',
      ownerUserId: 'u1',
      farmId: null,
      title: 'Hazelnuts',
      description: 'Old',
      category: null,
      variety: null,
      country: null,
      originPlace: null,
      unit: null,
      minQuantity: null,
      maxQuantity: null,
      currentStock: null,
      monthlyProduction: null,
      maxAnnualProduction: null,
      seasonMonths: [],
      harvestStartAt: null,
      harvestEndAt: null,
      forecastQuantity: null,
      harvestStatus: null,
      preorderEnabled: false,
      attributes: {},
      packagingTypes: [],
      packagingWeights: [],
      palletSize: null,
      incoterms: [],
      carriers: [],
      customDelivery: null,
      nearestPort: null,
      deliveryAvailable: false,
      leadTimeDays: null,
      priceFrom: null,
      priceCurrency: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: true,
      moderationStatus: 'approved',
      moderationNote: null,
      moderatedAt: new Date('2026-01-01T00:00:00.000Z'),
      moderatedById: 'admin1',
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 'u1', displayName: null, avatarUrl: null },
      farm: null,
      images: [],
      videos: [],
      certificates: [],
    };
    prisma.product.findUnique.mockResolvedValue(existing);
    prisma.product.update.mockResolvedValue({
      ...existing,
      title: 'Updated hazelnuts',
      description: 'New',
      moderationStatus: 'approved',
    });

    await service.update(farmer, 'p1', {
      title: 'Updated hazelnuts',
      description: 'New',
      isPublished: true,
    });

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Updated hazelnuts',
          isPublished: true,
          moderationStatus: 'approved',
        }),
      }),
    );
  });

  it('lists harvest watches for the current user', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    prisma.harvestWatch.findMany.mockResolvedValue([
      {
        id: 'w1',
        createdAt,
        product: {
          id: 'p1',
          title: 'Hazelnuts',
          harvestStatus: 'growing',
          preorderEnabled: true,
          farm: { name: 'Kakheti Farm' },
        },
      },
    ]);

    const result = await service.listMyWatches({
      id: 'u1',
      email: 'buyer@example.com',
      role: 'buyer',
      locale: 'en',
      displayName: null,
    });

    expect(prisma.harvestWatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result).toEqual([
      {
        id: 'w1',
        productId: 'p1',
        productTitle: 'Hazelnuts',
        farmName: 'Kakheti Farm',
        harvestStatus: 'growing',
        preorderEnabled: true,
        createdAt: createdAt.toISOString(),
      },
    ]);
  });

  it('notifies watchers when a listing becomes public with available harvest', async () => {
    const notifications = {
      notifyHarvestAvailable: jest.fn().mockResolvedValue(undefined),
      notifyHarvestPreorderOpen: jest.fn().mockResolvedValue(undefined),
      notifyProductPendingModeration: jest.fn().mockResolvedValue(undefined),
    };
    const localService = new ProductsService(
      prisma as never,
      storage as never,
      ratings as never,
      { enabledIds: jest.fn().mockResolvedValue(null) } as never,
      notifications as never,
    );

    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      ownerUserId: 'farmer1',
      title: 'Hazelnuts',
      harvestStatus: 'available',
      preorderEnabled: true,
      isPublished: true,
      moderationStatus: 'approved',
      owner: { id: 'farmer1', displayName: 'Nino', email: 'n@example.com' },
      farm: { name: 'Kakheti Farm' },
      images: [],
      videos: [],
      certificates: [],
    });
    prisma.harvestWatch.findMany.mockResolvedValue([
      {
        user: {
          id: 'buyer1',
          email: 'buyer@example.com',
          locale: 'ru',
          displayName: 'Buyer',
          blockedAt: null,
        },
      },
    ]);

    await localService.dispatchHarvestWatchNotifications({
      productId: 'p1',
      previousStatus: 'available',
      previousPreorder: true,
      wasPublic: false,
    });

    expect(notifications.notifyHarvestAvailable).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p1',
        harvestStatus: 'available',
        user: expect.objectContaining({ id: 'buyer1' }),
      }),
    );
    expect(notifications.notifyHarvestPreorderOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p1',
        user: expect.objectContaining({ id: 'buyer1' }),
      }),
    );
  });
});
