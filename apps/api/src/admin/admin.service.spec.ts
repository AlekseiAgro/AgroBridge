import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const prisma = {
    product: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    farm: { count: jest.fn() },
    user: { count: jest.fn() },
  };

  const notifications = {
    notifyProductApproved: jest.fn().mockResolvedValue(undefined),
    notifyProductRejected: jest.fn().mockResolvedValue(undefined),
  };

  let service: AdminService;

  const admin = {
    id: 'admin1',
    email: 'admin@example.com',
    role: 'admin' as const,
    locale: 'en' as const,
    displayName: 'Admin',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(prisma as never, notifications as never);
  });

  it('returns dashboard stats', async () => {
    prisma.product.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);
    prisma.farm.count.mockResolvedValue(3);
    prisma.user.count.mockResolvedValue(10);

    await expect(service.stats()).resolves.toEqual({
      productsPending: 2,
      productsApproved: 5,
      productsRejected: 1,
      farmsTotal: 3,
      usersTotal: 10,
    });
  });

  it('rejects approve for missing product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.approve(admin, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
