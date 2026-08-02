import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const prisma = {
    farm: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(prisma as never);
  });

  it('requires a farm before creating products', async () => {
    prisma.farm.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          id: 'u1',
          email: 'f@example.com',
          role: 'farmer',
          locale: 'en',
          displayName: null,
        },
        { title: 'Hazelnuts' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects buyers from managing products', async () => {
    await expect(
      service.listMine({
        id: 'u2',
        email: 'b@example.com',
        role: 'buyer',
        locale: 'en',
        displayName: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
