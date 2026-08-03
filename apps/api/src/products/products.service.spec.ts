import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    );
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

  it('rejects unsupported image types', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      farm: { ownerId: 'u1' },
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
});
