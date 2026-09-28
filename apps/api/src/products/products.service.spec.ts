import { INTERNAL_DRAFT_PRODUCT_TITLES } from '@agrobridge/shared';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
      groupBy: jest.fn().mockResolvedValue([]),
    },
    productView: {
      findFirst: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
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
    prisma.productView.groupBy.mockResolvedValue([]);
    prisma.harvestWatch.groupBy.mockResolvedValue([]);
    prisma.productView.findFirst.mockResolvedValue(null);
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

  it('stores GEL, EUR, and USD and rejects an invalid product currency', async () => {
    const farmer = {
      id: 'u1',
      email: 'f@example.com',
      role: 'farmer' as const,
      locale: 'en' as const,
      displayName: null,
    };
    const created = {
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
      priceFrom: 2.62,
      priceCurrency: 'EUR',
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
    };
    prisma.farm.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue(created);

    for (const currency of ['GEL', 'EUR', 'USD'] as const) {
      await service.create(farmer, { title: 'Hazelnuts', priceCurrency: currency } as never);
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priceCurrency: currency, priceFrom: null }),
        }),
      );
    }

    await expect(
      service.create(farmer, { title: 'Hazelnuts', priceCurrency: 'GBP' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not overwrite a saved EUR or USD currency unless a new valid code is sent', async () => {
    const farmer = {
      id: 'u1',
      email: 'f@example.com',
      role: 'farmer' as const,
      locale: 'en' as const,
      displayName: null,
    };
    const existing = {
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
      priceFrom: 2.62,
      priceCurrency: 'EUR',
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: false,
      moderationStatus: 'draft',
      moderationNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 'u1', displayName: null, avatarUrl: null },
      farm: null,
      images: [],
      videos: [],
      certificates: [],
    };
    prisma.product.findUnique.mockResolvedValue(existing);
    prisma.product.update.mockResolvedValue(existing);

    await service.update(farmer, 'p1', { title: 'Hazelnuts' } as never);
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceCurrency: undefined, priceFrom: undefined }),
      }),
    );

    prisma.product.findUnique.mockResolvedValue({ ...existing, priceCurrency: 'USD' });
    prisma.product.update.mockResolvedValue({ ...existing, priceCurrency: 'USD' });
    await service.update(farmer, 'p1', { priceCurrency: 'USD' } as never);
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priceCurrency: 'USD', priceFrom: undefined }),
      }),
    );

    await expect(service.update(farmer, 'p1', { priceCurrency: 'GBP' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
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

  it('keeps draft-title filters when listing the public catalog', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.catalog({});

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublished: true,
          moderationStatus: 'approved',
          AND: expect.arrayContaining([
            { title: { not: '' } },
            { title: { notIn: [...INTERNAL_DRAFT_PRODUCT_TITLES] } },
          ]),
        }),
      }),
    );
  });

  it('does not drop draft-title filters when category AND is applied', async () => {
    const categories = { enabledIds: jest.fn().mockResolvedValue(['fruits']) };
    const filtered = new ProductsService(
      prisma as never,
      storage as never,
      ratings as never,
      categories as never,
      {
        notifyHarvestAvailable: jest.fn().mockResolvedValue(undefined),
        notifyHarvestPreorderOpen: jest.fn().mockResolvedValue(undefined),
        notifyProductPendingModeration: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    prisma.product.findMany.mockResolvedValue([]);

    await filtered.catalog({ category: 'fruits' });

    const where = prisma.product.findMany.mock.calls[0]?.[0]?.where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { title: { not: '' } },
        { title: { notIn: [...INTERNAL_DRAFT_PRODUCT_TITLES] } },
        { category: 'fruits' },
      ]),
    );
  });

  it('hides a published draft title from public getById and keeps a real title visible', async () => {
    const published = {
      id: 'p1',
      ownerUserId: 'u1',
      farmId: null,
      title: 'Новый товар',
      description: null,
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
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 'u1', displayName: 'Owner' },
      farm: null,
      images: [],
      videos: [],
      certificates: [],
    };
    prisma.product.findUnique.mockResolvedValue(published);

    await expect(service.getById('p1', null)).rejects.toBeInstanceOf(NotFoundException);

    prisma.product.findUnique.mockResolvedValue({
      ...published,
      title: 'Fresh Kakheti peaches',
    });
    const detail = await service.getById('p1', null);
    expect(detail.title).toBe('Fresh Kakheti peaches');
  });

  it('lets the owner still open a listing that uses an internal draft title', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      ownerUserId: 'u1',
      farmId: null,
      title: 'Новый товар',
      description: null,
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
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 'u1', displayName: 'Owner' },
      farm: null,
      images: [],
      videos: [],
      certificates: [],
    });

    const detail = await service.getById('p1', {
      id: 'u1',
      email: 'f@example.com',
      role: 'farmer',
      locale: 'en',
      displayName: null,
    });
    expect(detail.title).toBe('Новый товар');
  });

  it('hides a pending listing from the public catalog and other buyers', async () => {
    const pending = {
      id: 'p1',
      ownerUserId: 'u1',
      farmId: 'farm1',
      title: 'Kakheti hazelnuts',
      description: 'Export grade',
      category: 'nuts',
      variety: 'Anakliuri',
      country: 'Georgia',
      originPlace: 'Gurjaani',
      unit: 'kg',
      minQuantity: 100,
      maxQuantity: 5000,
      currentStock: 800,
      monthlyProduction: 200,
      maxAnnualProduction: 4000,
      seasonMonths: [8, 9],
      harvestStartAt: null,
      harvestEndAt: null,
      forecastQuantity: null,
      harvestStatus: null,
      preorderEnabled: false,
      attributes: { organic: true },
      packagingTypes: ['bag'],
      packagingWeights: ['25 kg'],
      palletSize: null,
      incoterms: ['EXW'],
      carriers: [],
      customDelivery: null,
      nearestPort: 'Poti',
      deliveryAvailable: true,
      leadTimeDays: 7,
      priceFrom: 4.2,
      priceCurrency: 'USD',
      priceNegotiable: true,
      priceDependsOnVolume: false,
      isPublished: false,
      moderationStatus: 'pending',
      moderationNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 'u1', displayName: 'Nino' },
      farm: {
        id: 'farm1',
        name: 'Kakheti Farm',
        region: 'kakheti',
        verificationStatus: 'approved',
        foundedYear: 2012,
        farmSizeHectares: 12,
        ownershipType: 'family',
        exportMarkets: ['DE'],
        history: null,
      },
      images: [
        {
          id: 'img1',
          url: '/api/uploads/products/p1/photo.jpg',
          sortOrder: 0,
          isPrimary: true,
          kind: 'photo',
        },
      ],
      videos: [],
      certificates: [],
    };
    prisma.product.findUnique.mockResolvedValue(pending);

    await expect(service.getById('p1', null)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getById('p1', {
        id: 'buyer1',
        email: 'buyer@example.com',
        role: 'buyer',
        locale: 'en',
        displayName: 'Buyer',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const adminDetail = await service.getById('p1', {
      id: 'admin1',
      email: 'admin@example.com',
      role: 'admin',
      locale: 'en',
      displayName: 'Admin',
    });
    expect(adminDetail.title).toBe('Kakheti hazelnuts');
    expect(adminDetail.priceFrom).toBe(4.2);
    expect(adminDetail.priceCurrency).toBe('USD');
    expect(adminDetail.images).toEqual([
      expect.objectContaining({ url: '/api/uploads/products/p1/photo.jpg' }),
    ]);
    expect(adminDetail.attributes).toEqual({ organic: true });
    expect(adminDetail.farm?.name).toBe('Kakheti Farm');
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
          isPublished: true,
          moderationStatus: 'approved',
          harvestStatus: 'growing',
          preorderEnabled: true,
          ownerUserId: 'seller1',
          owner: { id: 'seller1', displayName: 'Nino' },
          farm: {
            id: 'f1',
            name: 'Kakheti Farm',
            region: 'kakheti',
            verificationStatus: 'approved',
          },
          images: [{ url: 'https://cdn.example/p1.jpg' }],
        },
      },
    ]);
    ratings.summariesForUsers.mockResolvedValue(
      new Map([['seller1', { average: 4.5, count: 3 }]]),
    );

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
        harvestStatus: 'growing',
        preorderEnabled: true,
        createdAt: createdAt.toISOString(),
        imageUrl: 'https://cdn.example/p1.jpg',
        owner: { id: 'seller1', displayName: 'Nino' },
        sellerRating: { average: 4.5, count: 3 },
        farm: {
          id: 'f1',
          name: 'Kakheti Farm',
          region: 'kakheti',
          verified: true,
        },
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

  it('does not notify harvest watchers when the listing still uses a draft title', async () => {
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
      title: 'Новый товар',
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

    await localService.dispatchHarvestWatchNotifications({
      productId: 'p1',
      previousStatus: 'available',
      previousPreorder: true,
      wasPublic: false,
    });

    expect(notifications.notifyHarvestAvailable).not.toHaveBeenCalled();
    expect(notifications.notifyHarvestPreorderOpen).not.toHaveBeenCalled();
    expect(prisma.harvestWatch.findMany).not.toHaveBeenCalled();
  });

  it('omits watches whose product is not publicly listed', async () => {
    prisma.harvestWatch.findMany.mockResolvedValue([
      {
        id: 'hidden',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        product: {
          id: 'p-draft',
          title: 'Новый товар',
          isPublished: true,
          moderationStatus: 'approved',
          harvestStatus: 'available',
          preorderEnabled: false,
          ownerUserId: 'seller1',
          owner: { id: 'seller1', displayName: 'Nino' },
          farm: null,
          images: [],
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
    expect(result).toEqual([]);
  });

  const farmer = {
    id: 'u1',
    email: 'f@example.com',
    role: 'farmer' as const,
    locale: 'en' as const,
    displayName: null,
  };

  const completeListing = {
    title: 'Kakheti hazelnuts',
    category: 'nuts',
    unit: 'kg',
    priceFrom: 4.2,
    priceCurrency: 'GEL' as const,
  };

  function productRow(overrides: Record<string, unknown> = {}) {
    return {
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
      ...overrides,
    };
  }

  it('creates a published listing when required fields are present and keeps optional fields empty', async () => {
    prisma.farm.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue(
      productRow({
        ...completeListing,
        isPublished: true,
        moderationStatus: 'pending',
      }),
    );

    const result = await service.create(farmer, {
      ...completeListing,
      isPublished: true,
    } as never);

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Kakheti hazelnuts',
          category: 'nuts',
          unit: 'kg',
          priceFrom: 4.2,
          priceCurrency: 'GEL',
          isPublished: true,
          moderationStatus: 'pending',
          description: null,
        }),
      }),
    );
    expect(result.moderationStatus).toBe('pending');
  });

  it.each([
    ['title', { ...completeListing, title: 'Untitled product', isPublished: true }],
    ['priceFrom', { ...completeListing, priceFrom: undefined, isPublished: true }],
    ['category', { ...completeListing, category: undefined, isPublished: true }],
    ['unit', { ...completeListing, unit: undefined, isPublished: true }],
    ['priceCurrency', { ...completeListing, priceCurrency: undefined, isPublished: true }],
  ] as const)('rejects published create missing %s', async (field, dto) => {
    prisma.farm.findUnique.mockResolvedValue(null);

    await expect(service.create(farmer, dto as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
    void field;
  });

  it('still creates a title-only draft', async () => {
    prisma.farm.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue(productRow({ title: 'Untitled product' }));

    await service.create(farmer, { title: 'Untitled product', isPublished: false } as never);

    expect(prisma.product.create).toHaveBeenCalled();
  });

  it('rejects publishing an incomplete draft and allows a complete publish', async () => {
    const draft = productRow({ title: 'Hazelnuts' });
    prisma.product.findUnique.mockResolvedValue(draft);

    await expect(
      service.update(farmer, 'p1', { isPublished: true } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.update).not.toHaveBeenCalled();

    prisma.product.findUnique.mockResolvedValue(draft);
    prisma.product.update.mockResolvedValue(
      productRow({
        ...completeListing,
        isPublished: true,
        moderationStatus: 'pending',
      }),
    );

    await service.update(farmer, 'p1', { ...completeListing, isPublished: true } as never);

    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isPublished: true,
          moderationStatus: 'pending',
          title: 'Kakheti hazelnuts',
          priceFrom: 4.2,
        }),
      }),
    );
  });

  it('rejects clearing the price on a complete published listing', async () => {
    const live = productRow({
      ...completeListing,
      isPublished: true,
      moderationStatus: 'approved',
    });
    prisma.product.findUnique.mockResolvedValue(live);

    await expect(
      service.update(farmer, 'p1', { priceFrom: null, isPublished: true } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('updates a complete published listing and keeps it approved', async () => {
    const live = productRow({
      ...completeListing,
      isPublished: true,
      moderationStatus: 'approved',
      moderatedAt: new Date('2026-01-01T00:00:00.000Z'),
      moderatedById: 'admin1',
    });
    prisma.product.findUnique.mockResolvedValue(live);
    prisma.product.update.mockResolvedValue({
      ...live,
      title: 'Updated hazelnuts',
    });

    await service.update(farmer, 'p1', {
      title: 'Updated hazelnuts',
      isPublished: true,
    } as never);

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

  it('marks an owned product soldOut without deleting it or changing other fields', async () => {
    const live = productRow({
      ...completeListing,
      description: 'Keep this description',
      currentStock: 800,
      harvestStatus: 'available',
      preorderEnabled: false,
      isPublished: true,
      moderationStatus: 'approved',
      images: [
        {
          id: 'img1',
          url: '/photo.jpg',
          sortOrder: 0,
          isPrimary: true,
          kind: 'photo',
        },
      ],
      certificates: [],
    });
    const updated = { ...live, harvestStatus: 'soldOut' };
    prisma.product.findUnique.mockResolvedValue(live);
    prisma.product.update.mockResolvedValue(updated);

    const result = await service.update(farmer, 'p1', { harvestStatus: 'soldOut' } as never);

    expect(prisma.product.delete).not.toHaveBeenCalled();
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({
          harvestStatus: 'soldOut',
          currentStock: undefined,
          title: undefined,
          description: undefined,
          isPublished: true,
          moderationStatus: 'approved',
        }),
      }),
    );
    expect(result.harvestStatus).toBe('soldOut');
    expect(result.title).toBe('Kakheti hazelnuts');
    expect(result.description).toBe('Keep this description');
    expect(result.currentStock).toBe(800);
    expect(result.images).toEqual([
      expect.objectContaining({ url: '/photo.jpg' }),
    ]);
    expect(prisma.harvestWatch.findMany).not.toHaveBeenCalled();
  });

  it('rejects harvestStatus updates for a product owned by another seller', async () => {
    prisma.product.findUnique.mockResolvedValue(
      productRow({
        ownerUserId: 'other-seller',
        harvestStatus: 'available',
      }),
    );

    await expect(
      service.update(farmer, 'p1', { harvestStatus: 'soldOut' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it('does not notify harvest watchers when a listing is marked soldOut', async () => {
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
    const live = productRow({
      ...completeListing,
      harvestStatus: 'available',
      isPublished: true,
      moderationStatus: 'approved',
    });
    prisma.product.findUnique.mockResolvedValue(live);
    prisma.product.update.mockResolvedValue({ ...live, harvestStatus: 'soldOut' });

    await localService.update(farmer, 'p1', { harvestStatus: 'soldOut' } as never);

    expect(notifications.notifyHarvestAvailable).not.toHaveBeenCalled();
    expect(notifications.notifyHarvestPreorderOpen).not.toHaveBeenCalled();
    expect(prisma.harvestWatch.findMany).not.toHaveBeenCalled();
  });

  it('attaches owner-only view and HarvestWatch counts on listMine without watcher identities', async () => {
    prisma.product.findMany.mockResolvedValue([
      productRow({
        id: 'p1',
        isPublished: true,
        moderationStatus: 'approved',
      }),
    ]);
    prisma.productView.groupBy.mockResolvedValue([
      { productId: 'p1', _count: { _all: 124 } },
    ]);
    prisma.harvestWatch.groupBy.mockResolvedValue([
      { productId: 'p1', _count: { _all: 8 } },
    ]);

    const listed = await service.listMine(farmer);

    expect(listed).toHaveLength(1);
    expect(listed[0].viewCount).toBe(124);
    expect(listed[0].watchCount).toBe(8);
    expect(JSON.stringify(listed)).not.toContain('visitorKey');
    expect(JSON.stringify(listed)).not.toContain('viewerUserId');
    expect(listed[0]).not.toHaveProperty('harvestWatches');
    expect(listed[0]).not.toHaveProperty('views');
    expect(prisma.harvestWatch.findMany).not.toHaveBeenCalled();
  });

  it('records a public product-detail view for a guest and skips the seller', async () => {
    const live = productRow({
      isPublished: true,
      moderationStatus: 'approved',
      title: 'Kakheti hazelnuts',
    });
    // Honour Prisma `select`. Returning the full row hid the production bug:
    // isPubliclyListedProduct treats a missing title as an internal draft.
    prisma.product.findUnique.mockImplementation(
      async (args: { select?: Record<string, boolean> }) => {
        const select = args?.select;
        if (!select) return live;
        return Object.fromEntries(
          Object.entries(select)
            .filter(([, include]) => include)
            .map(([key]) => [key, live[key as keyof typeof live]]),
        );
      },
    );
    prisma.productView.findFirst.mockResolvedValue(null);
    prisma.productView.create.mockResolvedValue({ id: 'v1' });

    const guest = await service.recordPublicProductView('p1', null, {
      ip: '203.0.113.10',
      userAgent: 'Mozilla/5.0',
    });
    expect(guest).toEqual({ recorded: true });
    expect(prisma.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        select: expect.objectContaining({
          title: true,
          isPublished: true,
          moderationStatus: true,
          ownerUserId: true,
        }),
      }),
    );
    expect(prisma.productView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'p1',
        source: 'organic',
        viewerUserId: null,
      }),
    });
    const created = prisma.productView.create.mock.calls[0][0] as {
      data: { visitorKey: string };
    };
    expect(created.data.visitorKey.startsWith('guest:')).toBe(true);
    expect(created.data.visitorKey).not.toContain('203.0.113.10');

    prisma.productView.create.mockClear();
    const owner = await service.recordPublicProductView('p1', farmer, {
      ip: '203.0.113.11',
      userAgent: 'Mozilla/5.0',
    });
    expect(owner).toEqual({ recorded: false });
    expect(prisma.productView.create).not.toHaveBeenCalled();
  });

  it('does not 404 a published listing when Prisma select omits unused columns', async () => {
    const live = productRow({
      isPublished: true,
      moderationStatus: 'approved',
      title: 'Kakheti hazelnuts',
    });
    prisma.product.findUnique.mockImplementation(
      async (args: { select?: Record<string, boolean> }) => {
        const select = args?.select;
        if (!select) return live;
        return Object.fromEntries(
          Object.entries(select)
            .filter(([, include]) => include)
            .map(([key]) => [key, live[key as keyof typeof live]]),
        );
      },
    );
    prisma.productView.findFirst.mockResolvedValue(null);
    prisma.productView.create.mockResolvedValue({ id: 'v1' });

    await expect(
      service.recordPublicProductView('p1', null, {
        ip: '198.51.100.8',
        userAgent: 'Mozilla/5.0',
      }),
    ).resolves.toEqual({ recorded: true });
    expect(prisma.productView.create).toHaveBeenCalled();
  });

  it('does not count a repeat view from the same visitor within 24 hours', async () => {
    prisma.product.findUnique.mockResolvedValue(
      productRow({
        isPublished: true,
        moderationStatus: 'approved',
      }),
    );
    prisma.productView.findFirst.mockResolvedValue({ id: 'existing' });

    const result = await service.recordPublicProductView(
      'p1',
      { ...farmer, id: 'buyer-1' },
      { ip: '198.51.100.20', userAgent: 'Mozilla/5.0' },
    );

    expect(result).toEqual({ recorded: false });
    expect(prisma.productView.create).not.toHaveBeenCalled();
    expect(prisma.productView.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: 'p1',
          visitorKey: 'user:buyer-1',
        }),
      }),
    );
  });
});
