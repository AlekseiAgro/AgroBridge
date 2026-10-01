import { AdminService } from '../admin/admin.service';
import { FarmsService } from '../farms/farms.service';
import { ProductsService } from '../products/products.service';
import { PurchaseRequestsService } from '../purchase-requests/purchase-requests.service';

const farmer = {
  id: 'u1',
  email: 'f@example.com',
  role: 'farmer' as const,
  locale: 'en' as const,
  displayName: null,
};

const admin = {
  id: 'admin1',
  email: 'admin@example.com',
  role: 'admin' as const,
  locale: 'en' as const,
  displayName: 'Admin',
};

const buyer = {
  id: 'b1',
  email: 'buyer@example.com',
  role: 'buyer' as const,
  locale: 'en' as const,
  displayName: 'Buyer Ltd',
};

function indexNowMock() {
  return {
    submitProduct: jest.fn().mockResolvedValue(undefined),
    submitFarm: jest.fn().mockResolvedValue(undefined),
    submitPurchaseRequest: jest.fn().mockResolvedValue(undefined),
  };
}

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product01',
    ownerUserId: 'u1',
    farmId: null,
    title: 'Kakheti hazelnuts',
    description: 'Export grade',
    category: 'nuts',
    variety: null,
    country: 'Georgia',
    originPlace: null,
    unit: 'kg',
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
    priceFrom: 4.2,
    priceCurrency: 'GEL',
    priceNegotiable: false,
    priceDependsOnVolume: false,
    isPublished: false,
    moderationStatus: 'draft',
    moderationNote: null,
    moderatedAt: null,
    moderatedById: null,
    sourceLocale: 'en',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    owner: { id: 'u1', displayName: null, email: 'f@example.com', locale: 'en' },
    farm: null,
    images: [],
    videos: [],
    certificates: [],
    ...overrides,
  };
}

describe('IndexNow mutation triggers', () => {
  describe('products', () => {
    const prisma = {
      farm: { findUnique: jest.fn() },
      product: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      productImage: { count: jest.fn(), findMany: jest.fn() },
      productVideo: { findMany: jest.fn() },
      productCertificate: { findMany: jest.fn() },
      harvestWatch: { findMany: jest.fn(), groupBy: jest.fn() },
      user: { findMany: jest.fn() },
    };
    const indexNow = indexNowMock();
    const service = new ProductsService(
      prisma as never,
      { upload: jest.fn(), delete: jest.fn() } as never,
      {
        summaryForUser: jest.fn().mockResolvedValue({ average: null, count: 0 }),
        summariesForUsers: jest.fn().mockResolvedValue(new Map()),
      } as never,
      { enabledIds: jest.fn().mockResolvedValue(null) } as never,
      {
        notifyHarvestAvailable: jest.fn(),
        notifyHarvestPreorderOpen: jest.fn(),
        notifyProductPendingModeration: jest.fn(),
      } as never,
      undefined,
      indexNow as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      prisma.productImage.count.mockResolvedValue(1);
      prisma.productImage.findMany.mockResolvedValue([]);
      prisma.productVideo.findMany.mockResolvedValue([]);
      prisma.productCertificate.findMany.mockResolvedValue([]);
      prisma.harvestWatch.findMany.mockResolvedValue([]);
      prisma.harvestWatch.groupBy.mockResolvedValue([]);
    });

    it('does not notify when a draft product is created', async () => {
      prisma.farm.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(productRow());

      await service.create(farmer, { title: 'Kakheti hazelnuts' });

      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('does not notify when a draft product is updated', async () => {
      const draft = productRow();
      prisma.product.findUnique.mockResolvedValue(draft);
      prisma.product.update.mockResolvedValue({ ...draft, description: 'Still a draft' });

      await service.update(farmer, 'product01', { description: 'Still a draft' });

      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('notifies when a public product changes public content', async () => {
      const live = productRow({ isPublished: true, moderationStatus: 'approved' });
      prisma.product.findUnique.mockResolvedValue(live);
      prisma.product.update.mockResolvedValue({ ...live, title: 'Updated hazelnuts' });

      await service.update(farmer, 'product01', {
        title: 'Updated hazelnuts',
        isPublished: true,
      } as never);

      expect(indexNow.submitProduct).toHaveBeenCalledTimes(1);
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');
    });

    it('notifies when a public product is deleted and skips a draft', async () => {
      prisma.product.findUnique.mockResolvedValue(
        productRow({ isPublished: true, moderationStatus: 'approved' }),
      );
      prisma.product.delete.mockResolvedValue({});

      await service.remove(farmer, 'product01');
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');

      indexNow.submitProduct.mockClear();
      prisma.product.findUnique.mockResolvedValue(productRow());
      await service.remove(farmer, 'product01');
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });
  });

  describe('admin product visibility', () => {
    const prisma = {
      product: { findUnique: jest.fn(), update: jest.fn() },
    };
    const indexNow = indexNowMock();
    const notifications = {
      notifyProductApproved: jest.fn().mockResolvedValue(undefined),
      notifyProductRejected: jest.fn().mockResolvedValue(undefined),
      notifyPurchaseRequestModerated: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AdminService(
      prisma as never,
      notifications as never,
      { notifyNewProduct: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { dispatchHarvestWatchNotifications: jest.fn().mockResolvedValue(undefined) } as never,
      indexNow as never,
    );

    const approvedRow = {
      id: 'product01',
      title: 'Kakheti hazelnuts',
      description: 'Export grade',
      category: 'nuts',
      unit: 'kg',
      isPublished: true,
      moderationStatus: 'approved' as const,
      moderationNote: null,
      moderatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      harvestStatus: null,
      preorderEnabled: false,
      owner: { id: 'u1', email: 'f@example.com', displayName: 'Nino', locale: 'en' },
      farm: null,
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('notifies when approval makes a product public', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...approvedRow,
        isPublished: false,
        moderationStatus: 'pending',
      });
      prisma.product.update.mockResolvedValue(approvedRow);

      await service.approve(admin, 'product01');

      expect(indexNow.submitProduct).toHaveBeenCalledTimes(1);
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');
    });

    it('does not notify when an already public product is approved again', async () => {
      prisma.product.findUnique.mockResolvedValue(approvedRow);
      prisma.product.update.mockResolvedValue(approvedRow);

      await service.approve(admin, 'product01');

      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('notifies when a public product is rejected and skips a draft', async () => {
      prisma.product.findUnique.mockResolvedValue(approvedRow);
      prisma.product.update.mockResolvedValue({
        ...approvedRow,
        moderationStatus: 'rejected',
      });

      await service.reject(admin, 'product01', { note: 'No' });
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');

      indexNow.submitProduct.mockClear();
      prisma.product.findUnique.mockResolvedValue({
        ...approvedRow,
        isPublished: false,
        moderationStatus: 'draft',
      });
      await service.reject(admin, 'product01', { note: 'No' });
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });
  });

  describe('farms', () => {
    const prisma = {
      farm: { findUnique: jest.fn(), update: jest.fn() },
    };
    const indexNow = indexNowMock();
    const service = new FarmsService(
      prisma as never,
      {
        summaryForUser: jest.fn().mockResolvedValue({ average: null, count: 0 }),
        summariesForUsers: jest.fn().mockResolvedValue(new Map()),
      } as never,
      { upload: jest.fn(), delete: jest.fn() } as never,
      { ensureIdentityReviewSubmitted: jest.fn(), syncPrimaryDocumentState: jest.fn() } as never,
      undefined,
      indexNow as never,
    );

    it('notifies after a farm profile update', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm00001',
        ownerId: 'u1',
        name: 'Test Farm',
        region: null,
        description: 'Orchard',
        foundedYear: null,
        farmSizeHectares: null,
        ownershipType: null,
        producerType: null,
        exportMarkets: [],
        history: null,
        sourceLocale: 'en',
        verificationStatus: 'unverified',
        verificationNote: null,
        verifiedAt: null,
        companyRegistrationNumber: null,
        companyRegistryValid: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: 'u1', displayName: 'Nino' },
        documents: [],
        images: [],
        products: [],
        _count: { products: 0 },
      });
      prisma.farm.update.mockResolvedValue({});

      await service.updateMine(farmer, { description: 'Updated orchard' });

      expect(indexNow.submitFarm).toHaveBeenCalledTimes(1);
      expect(indexNow.submitFarm).toHaveBeenCalledWith('farm00001');
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });
  });

  describe('purchase requests', () => {
    const tx = {
      purchaseRequest: { updateMany: jest.fn() },
      purchaseQuote: { updateMany: jest.fn(), findMany: jest.fn() },
    };
    const prisma = {
      purchaseRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      purchaseQuote: { updateMany: jest.fn() },
      $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
    };
    const indexNow = indexNowMock();
    const notifications = {
      notifyPurchaseQuoteDeclined: jest.fn().mockResolvedValue(undefined),
      notifyPurchaseRequestWithdrawn: jest.fn().mockResolvedValue(undefined),
      notifyPurchaseQuoteAccepted: jest.fn().mockResolvedValue(undefined),
      notifyPurchaseRequestModerated: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PurchaseRequestsService(
      prisma as never,
      { notifyNewPurchaseRequest: jest.fn().mockResolvedValue(undefined) } as never,
      notifications as never,
      undefined,
      indexNow as never,
    );
    const adminService = new AdminService(
      prisma as never,
      notifications as never,
      {} as never,
      {} as never,
      {} as never,
      indexNow as never,
    );

    function requestRow(status = 'open') {
      return {
        id: 'request01',
        buyerId: 'b1',
        title: 'Blueberries',
        category: 'berries',
        quantity: '1t',
        unit: null,
        variety: null,
        packaging: null,
        destinationCountry: null,
        message: null,
        status,
        moderationNote: null,
        moderatedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        buyer: { id: 'b1', displayName: 'Buyer Ltd', email: 'buyer@example.com', locale: 'en' },
        quotes: [
          {
            id: 'quote0001',
            requestId: 'request01',
            farmId: 'farm00001',
            status: 'pending',
            priceAmount: { toFixed: () => '10.00' },
            currency: 'USD',
            quantity: null,
            unit: null,
            message: null,
            validUntil: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            farm: {
              id: 'farm00001',
              name: 'Farm',
              region: null,
              ownerId: 'u1',
              owner: { id: 'u1', email: 'f@example.com', locale: 'en', displayName: null },
            },
          },
        ],
      };
    }

    beforeEach(() => {
      jest.clearAllMocks();
      tx.purchaseRequest.updateMany.mockResolvedValue({ count: 1 });
      tx.purchaseQuote.updateMany.mockResolvedValue({ count: 1 });
      tx.purchaseQuote.findMany.mockResolvedValue([]);
      prisma.purchaseQuote.updateMany.mockResolvedValue({ count: 1 });
    });

    it('notifies when a purchase request is published', async () => {
      prisma.purchaseRequest.create.mockResolvedValue(requestRow());

      await service.create(buyer, { title: 'Blueberries', category: 'berries', quantity: '1t' });

      expect(indexNow.submitPurchaseRequest).toHaveBeenCalledTimes(1);
      expect(indexNow.submitPurchaseRequest).toHaveBeenCalledWith('request01');
    });

    it('notifies when an open purchase request is closed', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow());

      await service.close(buyer, 'request01');

      expect(indexNow.submitPurchaseRequest).toHaveBeenCalledWith('request01');
    });

    it('notifies when an accepted quote takes the request off the public board', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow());

      await service.acceptQuote(buyer, 'request01', 'quote0001');

      expect(indexNow.submitPurchaseRequest).toHaveBeenCalledWith('request01');
    });

    it('does not notify for a quote-only decline', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow());

      await service.declineQuote(buyer, 'request01', 'quote0001');

      expect(indexNow.submitPurchaseRequest).not.toHaveBeenCalled();
    });

    it('notifies when an admin removes an open request and skips one that is already closed', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        ...requestRow(),
        _count: { quotes: 1 },
      });
      prisma.purchaseRequest.update.mockResolvedValue({
        ...requestRow('cancelled'),
        moderationNote: 'Removed',
        moderatedAt: new Date(),
        _count: { quotes: 1 },
      });

      await adminService.cancelPurchaseRequest(admin, 'request01', { note: 'Removed' });
      expect(indexNow.submitPurchaseRequest).toHaveBeenCalledWith('request01');

      indexNow.submitPurchaseRequest.mockClear();
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        ...requestRow('closed'),
        _count: { quotes: 1 },
      });
      await adminService.cancelPurchaseRequest(admin, 'request01', { note: 'Removed' });
      expect(indexNow.submitPurchaseRequest).not.toHaveBeenCalled();
    });
  });
});
