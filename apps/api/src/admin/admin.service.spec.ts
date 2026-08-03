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
    user: { count: jest.fn(), findMany: jest.fn() },
    rfq: { count: jest.fn() },
    purchaseRequest: { count: jest.fn() },
    farmDocument: { count: jest.fn() },
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
    prisma.farm.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prisma.user.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(6);
    prisma.rfq.count.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    prisma.purchaseRequest.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    prisma.farmDocument.count.mockResolvedValueOnce(1);
    prisma.user.findMany.mockResolvedValue([]);

    const stats = await service.stats();
    expect(stats.productsPending).toBe(2);
    expect(stats.productsApproved).toBe(5);
    expect(stats.farmsTotal).toBe(3);
    expect(stats.dealsCompleted).toBe(7);
    expect(stats.registrationsByDay).toHaveLength(14);
  });

  it('rejects approve for missing product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.approve(admin, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
