import { ConflictException, ForbiddenException } from '@nestjs/common';
import { FarmsService } from './farms.service';

describe('FarmsService', () => {
  const prisma = {
    farm: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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

  it('rejects non-farmers', async () => {
    await expect(
      service.create(
        {
          id: 'u1',
          email: 'b@example.com',
          role: 'buyer',
          locale: 'en',
          displayName: null,
        },
        { name: 'Test Farm' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
