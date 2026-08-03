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
});
