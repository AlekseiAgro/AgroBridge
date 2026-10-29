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
    farm: { count: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    user: { count: jest.fn(), findMany: jest.fn() },
    rfq: { count: jest.fn() },
    purchaseRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    farmDocument: { count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    productCertificate: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };

  const verification = {
    tryCompleteVerification: jest.fn().mockResolvedValue(undefined),
    syncPrimaryDocumentState: jest.fn().mockResolvedValue(undefined),
    applyModeratorDecision: jest.fn().mockResolvedValue(undefined),
  };

  const notifications = {
    notifyProductApproved: jest.fn().mockResolvedValue(undefined),
    notifyProductRejected: jest.fn().mockResolvedValue(undefined),
    notifyFarmDocumentReviewed: jest.fn().mockResolvedValue(undefined),
    notifyProductCertificateReviewed: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseRequestModerated: jest.fn().mockResolvedValue(undefined),
  };

  const subscriptions = {
    notifyNewProduct: jest.fn().mockResolvedValue(undefined),
  };

  const products = {
    getById: jest.fn(),
    dispatchHarvestWatchNotifications: jest.fn().mockResolvedValue(undefined),
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
      subscriptions as never,
      verification as never,
      products as never,
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

  describe('farm verification decisions', () => {
    const farmRow = {
      id: 'farm1',
      name: 'Kakheti Farm',
      region: null,
      description: null,
      logoUrl: null,
      verificationStatus: 'rejected',
      verificationNote: 'documents do not match',
      verifiedAt: null,
      createdAt: new Date(),
      owner: { id: 'u1', email: 'farmer@example.com', displayName: 'Farmer', blockedAt: null },
      documents: [],
      _count: { products: 0 },
    };

    it('rejects a decision on a farm that does not exist', async () => {
      prisma.farm.findUnique.mockResolvedValue(null);

      await expect(service.verifyFarm(admin, 'missing', true, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(verification.applyModeratorDecision).not.toHaveBeenCalled();
    });

    it('delegates the transition so the producer email follows the state change', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm1' });
      prisma.farm.findUniqueOrThrow.mockResolvedValue(farmRow);

      const result = await service.verifyFarm(admin, 'farm1', false, {
        note: '  documents do not match  ',
      });

      expect(verification.applyModeratorDecision).toHaveBeenCalledWith({
        farmId: 'farm1',
        adminId: 'admin1',
        approve: false,
        note: 'documents do not match',
      });
      expect(result.verificationStatus).toBe('rejected');
    });

    it('passes an empty note through as no comment at all', async () => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm1' });
      prisma.farm.findUniqueOrThrow.mockResolvedValue({
        ...farmRow,
        verificationStatus: 'approved',
        verificationNote: null,
      });

      await service.verifyFarm(admin, 'farm1', true, { note: '   ' });

      expect(verification.applyModeratorDecision).toHaveBeenCalledWith({
        farmId: 'farm1',
        adminId: 'admin1',
        approve: true,
        note: null,
      });
    });
  });

  it('returns the full product detail for an authorized moderator', async () => {
    const detail = {
      id: 'p1',
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
      seasonMonths: [8, 9, 10],
      harvestStartAt: null,
      harvestEndAt: null,
      forecastQuantity: null,
      harvestStatus: null,
      preorderEnabled: false,
      attributes: { organic: true, caliber: '13-15' },
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
      priceDependsOnVolume: true,
      isPublished: false,
      moderationStatus: 'pending',
      moderationNote: null,
      images: [
        {
          id: 'img1',
          url: '/api/uploads/products/p1/photo.jpg',
          sortOrder: 0,
          isPrimary: true,
          kind: 'photo',
        },
      ],
      videoCount: 0,
      certificateBadges: [],
      qualityScore: { score: 40, tier: 'basic', missing: [] },
      opportunity: { kind: 'none' },
      ownerUserId: 'farmer1',
      owner: { id: 'farmer1', displayName: 'Nino' },
      sellerRating: { average: null, count: 0 },
      farm: {
        id: 'farm1',
        name: 'Kakheti Farm',
        region: 'kakheti',
        verificationStatus: 'approved',
        verified: true,
        foundedYear: 2012,
        farmSizeHectares: 12,
        ownershipType: 'family',
        exportMarkets: ['DE'],
        history: 'Family orchard',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      videos: [],
      certificates: [],
    };
    products.getById.mockResolvedValue(detail);

    const result = await service.getProduct(admin, 'p1');

    expect(products.getById).toHaveBeenCalledWith('p1', admin);
    expect(result.title).toBe('Kakheti hazelnuts');
    expect(result.description).toBe('Export grade');
    expect(result.category).toBe('nuts');
    expect(result.priceFrom).toBe(4.2);
    expect(result.priceCurrency).toBe('USD');
    expect(result.minQuantity).toBe(100);
    expect(result.unit).toBe('kg');
    expect(result.images).toEqual([
      expect.objectContaining({ url: '/api/uploads/products/p1/photo.jpg' }),
    ]);
    expect(result.attributes).toEqual({ organic: true, caliber: '13-15' });
    expect(result.farm?.name).toBe('Kakheti Farm');
    expect(result.farm?.region).toBe('kakheti');
    expect(prisma.farmDocument.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('does not treat a farm document id as a product', async () => {
    products.getById.mockRejectedValue(new NotFoundException('Product not found'));

    await expect(service.getProduct(admin, 'doc1')).rejects.toBeInstanceOf(NotFoundException);
    expect(products.getById).toHaveBeenCalledWith('doc1', admin);
    expect(prisma.farmDocument.findUnique).not.toHaveBeenCalled();
    expect(prisma.productCertificate.findUnique).not.toHaveBeenCalled();
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
    expect(notifications.notifyProductApproved).toHaveBeenCalledWith(
      expect.objectContaining({ productTitle: 'Hazelnuts', productId: 'p1' }),
    );
    expect(subscriptions.notifyNewProduct).toHaveBeenCalledWith(
      expect.objectContaining({ productTitle: 'Hazelnuts', productId: 'p1' }),
    );
    expect(products.dispatchHarvestWatchNotifications).toHaveBeenCalled();
  });

  it('does not announce a draft-title listing to marketplace subscribers after approve', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Новый товар',
      isPublished: false,
      moderationStatus: 'pending',
      harvestStatus: null,
      preorderEnabled: false,
    });
    prisma.product.update.mockResolvedValue({
      id: 'p1',
      title: 'Новый товар',
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

    const result = await service.approve(admin, 'p1');
    expect(result.title).toBe('Новый товар');
    expect(notifications.notifyProductApproved).not.toHaveBeenCalled();
    expect(subscriptions.notifyNewProduct).not.toHaveBeenCalled();
    expect(products.dispatchHarvestWatchNotifications).not.toHaveBeenCalled();
  });

  it('lets an admin approve or reject a certificate without exposing a storage URL', async () => {
    prisma.productCertificate.findUnique.mockResolvedValue({
      id: 'c1',
      productId: 'p1',
      title: 'Organic',
      reviewStatus: 'pending',
      product: {
        title: 'Hazelnuts',
        owner: { id: 'u1', email: 'f@example.com', locale: 'en', displayName: 'Nino' },
      },
    });
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
    prisma.productCertificate.findUnique.mockResolvedValue({
      id: 'c1',
      productId: 'p1',
      title: 'Organic',
      reviewStatus: 'pending',
      product: {
        title: 'Hazelnuts',
        owner: { id: 'u1', email: 'f@example.com', locale: 'en', displayName: 'Nino' },
      },
    });
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

  describe('verification document review', () => {
    const reviewedDocument = (reviewStatus: 'approved' | 'rejected') => ({
      id: 'doc1',
      farmId: 'farm1',
      title: 'ID card',
      fileName: 'id.pdf',
      mimeType: 'application/pdf',
      kind: 'idCard',
      reviewStatus,
      reviewNote: reviewStatus === 'rejected' ? 'illegible scan' : null,
      reviewedAt: new Date('2026-09-16T10:30:00.000Z'),
      createdAt: new Date('2026-09-16T10:00:00.000Z'),
    });

    it('re-runs verification completion when an ID card is approved', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue({
        id: 'doc1',
        kind: 'idCard',
        title: 'ID card',
        reviewStatus: 'pending',
        farm: {
          ownerId: 'owner1',
          owner: { id: 'owner1', email: 'f@example.com', locale: 'en', displayName: 'Farmer' },
        },
      });
      prisma.farmDocument.update.mockResolvedValue(reviewedDocument('approved'));

      await service.reviewDocument(admin, 'doc1', true, {});

      expect(verification.tryCompleteVerification).toHaveBeenCalledWith('owner1');
      expect(verification.syncPrimaryDocumentState).toHaveBeenCalledWith('owner1');
    });

    it('completes and reconciles a company after its registration document is approved', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue({
        id: 'doc3',
        kind: 'businessRegistration',
        title: 'Business registration',
        reviewStatus: 'pending',
        farm: {
          ownerId: 'owner2',
          owner: { id: 'owner2', email: 'c@example.com', locale: 'en', displayName: 'Company' },
        },
      });
      prisma.farmDocument.update.mockResolvedValue({
        ...reviewedDocument('approved'),
        id: 'doc3',
        kind: 'businessRegistration',
      });

      await service.reviewDocument(admin, 'doc3', true, {});

      // Without this pair a company stayed in moderation forever once its document was approved.
      expect(verification.tryCompleteVerification).toHaveBeenCalledWith('owner2');
      expect(verification.syncPrimaryDocumentState).toHaveBeenCalledWith('owner2');
    });

    it('drops the farm out of moderation when the identity document is rejected', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue({
        id: 'doc1',
        kind: 'idCard',
        title: 'ID card',
        reviewStatus: 'pending',
        farm: {
          ownerId: 'owner1',
          owner: { id: 'owner1', email: 'f@example.com', locale: 'en', displayName: 'Farmer' },
        },
      });
      prisma.farmDocument.update.mockResolvedValue(reviewedDocument('rejected'));

      await service.reviewDocument(admin, 'doc1', false, { note: 'illegible scan' });

      expect(verification.syncPrimaryDocumentState).toHaveBeenCalledWith('owner1');
      expect(verification.tryCompleteVerification).not.toHaveBeenCalled();
    });

    it('does not notify again when the same document decision is repeated', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue({
        id: 'doc2',
        kind: 'other',
        title: 'Supporting scan',
        reviewStatus: 'rejected',
        farm: {
          ownerId: 'owner1',
          owner: { id: 'owner1', email: 'f@example.com', locale: 'en', displayName: 'Farmer' },
        },
      });
      prisma.farmDocument.update.mockResolvedValue({
        ...reviewedDocument('rejected'),
        id: 'doc2',
        kind: 'other',
      });

      await service.reviewDocument(admin, 'doc2', false, {});

      expect(notifications.notifyFarmDocumentReviewed).not.toHaveBeenCalled();
    });

    it('leaves verification state alone for supporting documents', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue({
        id: 'doc2',
        kind: 'other',
        title: 'Supporting scan',
        reviewStatus: 'pending',
        farm: {
          ownerId: 'owner1',
          owner: { id: 'owner1', email: 'f@example.com', locale: 'en', displayName: 'Farmer' },
        },
      });
      prisma.farmDocument.update.mockResolvedValue({
        ...reviewedDocument('rejected'),
        id: 'doc2',
        kind: 'other',
      });

      await service.reviewDocument(admin, 'doc2', false, {});

      expect(verification.syncPrimaryDocumentState).not.toHaveBeenCalled();
      expect(verification.tryCompleteVerification).not.toHaveBeenCalled();
    });
  });

  it('passes the seller id on the first product approval so an in-app alert can be stored', async () => {
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

    expect(notifications.notifyProductApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        farmer: expect.objectContaining({ id: 'u1' }),
      }),
    );
  });

  it('does not persist a second in-app product alert when approval is repeated', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      isPublished: true,
      moderationStatus: 'approved',
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

    expect(notifications.notifyProductApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        farmer: { email: 'f@example.com', locale: 'en', displayName: 'Nino' },
      }),
    );
  });

  it('does not notify an admin who approves their own listing', async () => {
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
      owner: { id: 'admin1', email: 'admin@example.com', displayName: 'Admin', locale: 'en' },
      farm: null,
    });

    await service.approve(admin, 'p1');

    expect(notifications.notifyProductApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        farmer: { email: 'admin@example.com', locale: 'en', displayName: 'Admin' },
      }),
    );
  });

  it('notifies the buyer once when a moderator removes an open purchase request', async () => {
    prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: 'r1',
      title: 'Blueberries',
      category: 'berries',
      quantity: 1,
      unit: 't',
      status: 'open',
      moderationNote: null,
      moderatedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      buyer: { id: 'buyer1', email: 'b@example.com', locale: 'en', displayName: 'Buyer' },
      _count: { quotes: 0 },
    });
    prisma.purchaseRequest.update.mockResolvedValue({
      id: 'r1',
      title: 'Blueberries',
      category: 'berries',
      quantity: 1,
      unit: 't',
      status: 'cancelled',
      moderationNote: 'Spam',
      moderatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      buyer: { id: 'buyer1', email: 'b@example.com', locale: 'en', displayName: 'Buyer' },
      _count: { quotes: 0 },
    });

    await service.cancelPurchaseRequest(admin, 'r1', { note: 'Spam' });

    expect(notifications.notifyPurchaseRequestModerated).toHaveBeenCalledWith({
      buyer: expect.objectContaining({ id: 'buyer1' }),
      title: 'Blueberries',
      note: 'Spam',
    });
  });

  it('does not notify again when the purchase request is already cancelled', async () => {
    prisma.purchaseRequest.findUnique.mockResolvedValue({
      id: 'r1',
      title: 'Blueberries',
      category: 'berries',
      quantity: 1,
      unit: 't',
      status: 'cancelled',
      moderationNote: 'Spam',
      moderatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      buyer: { id: 'buyer1', email: 'b@example.com', locale: 'en', displayName: 'Buyer' },
      _count: { quotes: 0 },
    });
    prisma.purchaseRequest.update.mockResolvedValue({
      id: 'r1',
      title: 'Blueberries',
      category: 'berries',
      quantity: 1,
      unit: 't',
      status: 'cancelled',
      moderationNote: 'Spam',
      moderatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      buyer: { id: 'buyer1', email: 'b@example.com', locale: 'en', displayName: 'Buyer' },
      _count: { quotes: 0 },
    });

    await service.cancelPurchaseRequest(admin, 'r1', { note: 'Spam' });

    expect(notifications.notifyPurchaseRequestModerated).not.toHaveBeenCalled();
  });

  describe('phone-like content flags', () => {
    function requestRow(id: string, fields: Record<string, string | null> = {}) {
      return {
        id,
        title: 'Blueberries',
        category: 'berries',
        quantity: '20',
        unit: 't',
        variety: null,
        packaging: null,
        message: null,
        status: 'open',
        moderationNote: null,
        moderatedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        buyer: { id: 'buyer1', email: 'b@example.com', displayName: 'Buyer' },
        _count: { quotes: 0 },
        ...fields,
      };
    }

    function productRow(fields: Record<string, string | null> = {}) {
      return {
        id: 'p1',
        title: 'Apples',
        description: 'Fresh apples, 20 t, GlobalG.A.P. GGN 4063061234567.',
        variety: 'Golden',
        originPlace: 'Gori',
        customDelivery: null,
        category: 'fruits',
        unit: 'kg',
        isPublished: false,
        moderationStatus: 'pending',
        moderationNote: null,
        moderatedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        owner: { id: 'u1', email: 'farmer@example.com', displayName: 'Farmer', locale: 'en' },
        farm: null,
        ...fields,
      };
    }

    type RequestRow = ReturnType<typeof requestRow>;

    /**
     * Mirrors the Prisma semantics listPurchaseRequests relies on: status / id-in
     * filters, (createdAt desc, id desc) ordering, keyset cursor with skip, and take.
     * Unordered id-in reads come back reversed to prove the service restores order.
     */
    function serveRequests(rows: RequestRow[]) {
      prisma.purchaseRequest.findMany.mockImplementation(
        (args: {
          where?: { status?: string; id?: { in: string[] } };
          orderBy?: unknown;
          cursor?: { id: string };
          skip?: number;
          take?: number;
        }) => {
          let result = rows.filter(
            (row) =>
              (!args.where?.status || row.status === args.where.status) &&
              (!args.where?.id || args.where.id.in.includes(row.id)),
          );
          if (args.orderBy) {
            result = [...result].sort(
              (a, b) =>
                b.createdAt.getTime() - a.createdAt.getTime() ||
                (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
            );
          } else {
            result = [...result].reverse();
          }
          if (args.cursor) {
            const at = result.findIndex((row) => row.id === args.cursor!.id);
            result = result.slice(at + (args.skip ?? 0));
          }
          if (args.take !== undefined) result = result.slice(0, args.take);
          return Promise.resolve(result);
        },
      );
    }

    function at(minutesAgo: number) {
      return new Date(Date.UTC(2026, 9, 1) - minutesAgo * 60_000);
    }

    function datedRow(id: string, minutesAgo: number, fields: Record<string, string | null> = {}) {
      return { ...requestRow(id, fields), createdAt: at(minutesAgo) };
    }

    it('names the purchase-request fields that look like phone numbers', async () => {
      serveRequests([
        requestRow('r1', {
          message: 'Call me on +995 591 71 23 16',
          packaging: 'WhatsApp 591712316',
        }),
      ]);

      const [request] = await service.listPurchaseRequests('open');

      expect(request.phoneLikeFields).toEqual(['message', 'packaging']);
      expect(request).not.toHaveProperty('message');
    });

    it('lists flagged purchase requests first and keeps newest-first order in each group', async () => {
      serveRequests([
        datedRow('clean-newest', 1),
        datedRow('flagged-newer', 2, { message: 'tel 591712316' }),
        datedRow('clean-older', 3, { message: 'Price 2.50 GEL per kg, 20 t' }),
        datedRow('flagged-older', 4, { title: 'Apples 599 12 34 56' }),
      ]);

      const requests = await service.listPurchaseRequests('open');

      expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      );
      expect(requests.map((request) => request.id)).toEqual([
        'flagged-newer',
        'flagged-older',
        'clean-newest',
        'clean-older',
      ]);
      expect(requests.map((request) => request.phoneLikeFields)).toEqual([
        ['message'],
        ['title'],
        [],
        [],
      ]);
    });

    it('breaks createdAt ties by id so the order is stable between reads', async () => {
      serveRequests([
        datedRow('req-a', 5),
        datedRow('req-c', 5),
        datedRow('req-b', 5),
        datedRow('req-f', 5, { message: 'tel 591712316' }),
        datedRow('req-d', 5, { message: 'tel 599123456' }),
      ]);

      const first = await service.listPurchaseRequests('open');
      const second = await service.listPurchaseRequests('open');

      expect(first.map((request) => request.id)).toEqual([
        'req-f',
        'req-d',
        'req-c',
        'req-b',
        'req-a',
      ]);
      expect(second.map((request) => request.id)).toEqual(first.map((request) => request.id));
    });

    it('surfaces a flagged request that is older than the newest 200', async () => {
      const rows = Array.from({ length: 1200 }, (_, index) =>
        datedRow(`clean-${String(index).padStart(4, '0')}`, index),
      );
      rows.push(datedRow('flagged-oldest', 5000, { message: 'WhatsApp +995 591 71 23 16' }));
      serveRequests(rows);

      const requests = await service.listPurchaseRequests('open');

      expect(requests).toHaveLength(200);
      expect(requests[0]).toMatchObject({ id: 'flagged-oldest', phoneLikeFields: ['message'] });
      expect(requests.slice(1).map((request) => request.id)).toEqual(
        rows.slice(0, 199).map((row) => row.id),
      );

      const scans = prisma.purchaseRequest.findMany.mock.calls
        .map(([args]) => args as { select?: unknown; take?: number; cursor?: unknown })
        .filter((args) => args.select);
      expect(scans).toHaveLength(3);
      expect(scans.every((args) => args.take === 500)).toBe(true);
      expect(scans[0].cursor).toBeUndefined();
      expect(scans[1].cursor).toEqual({ id: 'clean-0499' });
      expect(scans[2].cursor).toEqual({ id: 'clean-0999' });
      expect(scans[0].select).toEqual({
        id: true,
        title: true,
        message: true,
        variety: true,
        packaging: true,
      });
    });

    it('keeps the newest 200 flagged requests when more than 200 are flagged', async () => {
      const rows = [
        datedRow('clean-newest', 0),
        ...Array.from({ length: 700 }, (_, index) =>
          datedRow(`flagged-${String(index).padStart(4, '0')}`, index + 1, {
            message: 'tel 591712316',
          }),
        ),
      ];
      serveRequests(rows);

      const requests = await service.listPurchaseRequests('open');

      expect(requests).toHaveLength(200);
      expect(requests.map((request) => request.id)).toEqual(
        rows.slice(1, 201).map((row) => row.id),
      );
      expect(
        prisma.purchaseRequest.findMany.mock.calls.filter(
          ([args]) => (args as { select?: unknown }).select,
        ),
      ).toHaveLength(1);
    });

    it('applies the status tab to the scan and skips the detail read when nothing matches', async () => {
      serveRequests([datedRow('open-1', 1)]);

      await expect(service.listPurchaseRequests('cancelled')).resolves.toEqual([]);

      expect(prisma.purchaseRequest.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'cancelled' } }),
      );
    });

    it('flags a removed request in the cancel response without changing the removal', async () => {
      const row = requestRow('r1', { message: '+995 591 71 23 16' });
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        ...row,
        buyer: { ...row.buyer, locale: 'en' },
      });
      prisma.purchaseRequest.update.mockResolvedValue({
        ...row,
        status: 'cancelled',
        moderationNote: 'Spam',
        buyer: { ...row.buyer, locale: 'en' },
      });

      const result = await service.cancelPurchaseRequest(admin, 'r1', { note: 'Spam' });

      expect(result.status).toBe('cancelled');
      expect(result.phoneLikeFields).toEqual(['message']);
    });

    it('names the product fields that look like phone numbers', async () => {
      prisma.product.findMany.mockResolvedValue([
        productRow({
          description: 'Contact: 591712316.',
          customDelivery: 'Viber +995 599 12 34 56',
        }),
        productRow({ id: 'p2' }),
      ]);

      const products = await service.listProducts('pending');

      expect(products.map((product) => product.phoneLikeFields)).toEqual([
        ['description', 'customDelivery'],
        [],
      ]);
      expect(products[0].description).toBe('Contact: 591712316.');
    });

    it('only adds a hint: approving a flagged product still publishes it', async () => {
      const flagged = productRow({ description: 'Call 591712316', moderationStatus: 'pending' });
      prisma.product.findUnique.mockResolvedValue({ ...flagged, images: [] });
      prisma.product.update.mockResolvedValue({
        ...flagged,
        isPublished: true,
        moderationStatus: 'approved',
        images: [],
      });

      const result = await service.approve(admin, 'p1');

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ moderationStatus: 'approved', isPublished: true }),
        }),
      );
      expect(result.moderationStatus).toBe('approved');
      expect(result.phoneLikeFields).toEqual(['description']);
    });
  });
});
