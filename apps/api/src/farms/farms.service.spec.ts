import { ConflictException } from '@nestjs/common';
import { FarmsService } from './farms.service';

describe('FarmsService', () => {
  const prisma = {
    farm: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    rfq: {
      updateMany: jest.fn(),
    },
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
      {
        upload: jest.fn(),
        delete: jest.fn(),
      } as never,
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
});
