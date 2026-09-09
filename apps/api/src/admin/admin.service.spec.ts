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
    productCertificate: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
    service = new AdminService(
      prisma as never,
      notifications as never,
      { notifyNewProduct: jest.fn().mockResolvedValue(undefined) } as never,
      { tryCompleteVerification: jest.fn().mockResolvedValue(undefined) } as never,
      { dispatchHarvestWatchNotifications: jest.fn().mockResolvedValue(undefined) } as never,
    );
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

  it('does not approve pending certificates when a listing is approved', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      isPublished: false,
      moderationStatus: 'pending',
      harvestStatus: null,
      preorderEnabled: false,
    });
    prisma.product.update.mockResolvedValue({
      id: 'p1',
      title: 'Hazelnuts',
      category: null,
      isPublished: true,
      moderationStatus: 'approved',
      harvestStatus: null,
      preorderEnabled: false,
      moderationNote: null,
      moderatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      owner: { id: 'u1', email: 'f@example.com', displayName: 'Nino', locale: 'en' },
      farm: null,
    });

    await service.approve(admin, 'p1');

    expect(prisma.productCertificate.updateMany).not.toHaveBeenCalled();
    expect(prisma.productCertificate.update).not.toHaveBeenCalled();
  });

  it('lets an admin approve or reject a certificate without exposing a storage URL', async () => {
    prisma.productCertificate.findUnique.mockResolvedValue({ id: 'c1', productId: 'p1' });
    prisma.productCertificate.update.mockResolvedValue({
      id: 'c1',
      productId: 'p1',
      type: 'organic',
      title: 'Organic',
      fileName: 'organic.pdf',
      mimeType: 'application/pdf',
      reviewStatus: 'approved',
      reviewNote: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.reviewCertificate(admin, 'c1', true, {});
    expect(result.url).toBe('/api/products/p1/certificates/c1/file');
    expect(result.reviewStatus).toBe('approved');
  });

  it('lets an admin reject a certificate independently of the listing', async () => {
    prisma.productCertificate.findUnique.mockResolvedValue({ id: 'c1', productId: 'p1' });
    prisma.productCertificate.update.mockResolvedValue({
      id: 'c1',
      productId: 'p1',
      type: 'organic',
      title: 'Organic',
      fileName: 'organic.pdf',
      mimeType: 'application/pdf',
      reviewStatus: 'rejected',
      reviewNote: 'illegible scan',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.reviewCertificate(admin, 'c1', false, {
      note: 'illegible scan',
    });
    expect(result.reviewStatus).toBe('rejected');
    expect(result.reviewNote).toBe('illegible scan');
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('rejects a path-like certificate id on review', async () => {
    await expect(
      service.reviewCertificate(admin, '../etc/passwd', true, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.productCertificate.findUnique).not.toHaveBeenCalled();
  });
});
