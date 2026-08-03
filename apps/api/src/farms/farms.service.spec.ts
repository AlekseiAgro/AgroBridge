import { BadRequestException, ConflictException } from '@nestjs/common';
import { FarmsService } from './farms.service';

describe('FarmsService', () => {
  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const prisma = {
    farm: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    farmImage: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    rfq: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  };

  let service: FarmsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FarmsService(
      prisma as never,
      {
        summaryForUser: jest.fn().mockResolvedValue({ average: null, count: 0 }),
        summariesForUsers: jest.fn().mockResolvedValue(new Map()),
      } as never,
      storage as never,
    );
  });

  it('links existing products when a farm profile is created', async () => {
    prisma.farm.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'farm1',
        ownerId: 'u1',
        name: 'Test Farm',
        region: null,
        description: null,
        foundedYear: null,
        farmSizeHectares: null,
        ownershipType: null,
        exportMarkets: [],
        history: null,
        verificationStatus: 'unverified',
        verificationNote: null,
        verifiedAt: null,
        companyRegistrationNumber: null,
        companyRegistryValid: null,
        createdAt: new Date(),
        owner: { id: 'u1', displayName: 'Nino' },
        documents: [],
        images: [],
        products: [],
        _count: { products: 0 },
      });
    prisma.farm.create.mockResolvedValue({ id: 'farm1' });
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.rfq.updateMany.mockResolvedValue({ count: 0 });

    await service.create(
      {
        id: 'u1',
        email: 'f@example.com',
        role: 'farmer',
        locale: 'ka',
        displayName: 'Nino',
      },
      { name: 'Test Farm' },
    );

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { ownerUserId: 'u1', farmId: null },
      data: { farmId: 'farm1' },
    });
  });

  it('rejects second farm for same owner', async () => {
    prisma.farm.findUnique.mockResolvedValue({ id: 'farm1' });

    await expect(
      service.create(
        {
          id: 'u1',
          email: 'f@example.com',
          role: 'farmer',
          locale: 'ka',
          displayName: 'Nino',
        },
        { name: 'Second Farm' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a fourth farm photo', async () => {
    prisma.farm.findUnique.mockResolvedValue({ id: 'farm1', ownerId: 'u1' });
    prisma.farmImage.count.mockResolvedValue(3);

    await expect(
      service.uploadPhoto(
        {
          id: 'u1',
          email: 'f@example.com',
          role: 'farmer',
          locale: 'ka',
          displayName: 'Nino',
        },
        {
          buffer: Buffer.from('img'),
          mimetype: 'image/jpeg',
          originalname: 'farm.jpg',
          size: 1024,
        } as Express.Multer.File,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.upload).not.toHaveBeenCalled();
  });
});
