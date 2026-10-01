import { LocaleCode, MessageTranslationStatus } from '@prisma/client';
import {
  CatalogTranslationService,
  productSourceHash,
} from '../catalog/catalog-translation.service';
import { FarmsService } from '../farms/farms.service';
import { VerificationService } from '../verification/verification.service';

const farmer = {
  id: 'u1',
  email: 'f@example.com',
  role: 'farmer' as const,
  locale: 'en' as const,
  displayName: null,
};

function indexNowMock() {
  return {
    submitProduct: jest.fn().mockResolvedValue(undefined),
    submitFarm: jest.fn().mockResolvedValue(undefined),
    submitPurchaseRequest: jest.fn().mockResolvedValue(undefined),
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

function farmFixture() {
  return {
    id: 'farm00001',
    ownerId: 'u1',
    name: 'Test Farm',
    region: null,
    description: 'Orchard',
    foundedYear: null,
    farmSizeHectares: null,
    ownershipType: null,
    producerType: null,
    exportMarkets: [] as string[],
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
  };
}

describe('IndexNow public-page dependencies', () => {
  describe('farm fields already shown on product pages', () => {
    const prisma = {
      farm: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      product: { updateMany: jest.fn(), findMany: jest.fn() },
      rfq: { updateMany: jest.fn() },
      farmImage: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn((run: (tx: unknown) => unknown) =>
        run({
          farmImage: {
            updateMany: jest.fn(),
            update: jest.fn(),
          },
        }),
      ),
    };
    const indexNow = indexNowMock();
    const storage = { upload: jest.fn(), delete: jest.fn() };
    const service = new FarmsService(
      prisma as never,
      {
        summaryForUser: jest.fn().mockResolvedValue({ average: null, count: 0 }),
        summariesForUsers: jest.fn().mockResolvedValue(new Map()),
      } as never,
      storage as never,
      { ensureIdentityReviewSubmitted: jest.fn(), syncPrimaryDocumentState: jest.fn() } as never,
      undefined,
      indexNow as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      prisma.product.findMany.mockResolvedValue([{ id: 'product01' }]);
      prisma.product.updateMany.mockResolvedValue({ count: 1 });
      prisma.rfq.updateMany.mockResolvedValue({ count: 0 });
      prisma.farm.update.mockResolvedValue({});
    });

    it('notifies attached public products when a farm is created', async () => {
      prisma.farm.findUnique.mockResolvedValueOnce(null).mockResolvedValue(farmFixture());
      prisma.farm.create.mockResolvedValue({ id: 'farm00001' });

      await service.create(farmer, { name: 'Test Farm', description: 'Orchard' });
      await flush();

      expect(indexNow.submitFarm).toHaveBeenCalledWith('farm00001');
      expect(indexNow.submitProduct).toHaveBeenCalledTimes(1);
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');
    });

    it('notifies public products when the farm name changes', async () => {
      prisma.farm.findUnique.mockResolvedValue(farmFixture());

      await service.updateMine(farmer, { name: 'Renamed Farm' });
      await flush();

      expect(indexNow.submitFarm).toHaveBeenCalledWith('farm00001');
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');
    });

    it('does not notify product pages for a description-only farm update', async () => {
      prisma.farm.findUnique.mockResolvedValue(farmFixture());

      await service.updateMine(farmer, { description: 'Updated orchard' });
      await flush();

      expect(indexNow.submitFarm).toHaveBeenCalledTimes(1);
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('notifies only the farm URL when a photo is uploaded', async () => {
      prisma.farm.findUnique.mockResolvedValue(farmFixture());
      prisma.farmImage.count.mockResolvedValue(0);
      prisma.farmImage.create.mockResolvedValue({});
      storage.upload.mockResolvedValue({ url: 'https://cdn.example/a.jpg', key: 'photos/a' });

      await service.uploadPhoto(farmer, {
        mimetype: 'image/jpeg',
        size: 100,
        buffer: Buffer.from('photo'),
        originalname: 'a.jpg',
      } as Express.Multer.File);
      await flush();

      expect(indexNow.submitFarm).toHaveBeenCalledWith('farm00001');
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('does not notify when the chosen photo is already primary', async () => {
      prisma.farm.findUnique.mockResolvedValue(farmFixture());
      prisma.farmImage.findFirst.mockResolvedValue({
        id: 'photo0001',
        farmId: 'farm00001',
        isPrimary: true,
        key: 'photos/a',
      });

      await service.setPrimaryPhoto(farmer, 'photo0001');
      await flush();

      expect(indexNow.submitFarm).not.toHaveBeenCalled();
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });
  });

  describe('verification badge', () => {
    const prisma = {
      farm: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      product: { findMany: jest.fn() },
    };
    const notifications = {
      notifyVerificationApproved: jest.fn().mockResolvedValue(undefined),
      notifyVerificationRejected: jest.fn().mockResolvedValue(undefined),
    };
    const indexNow = indexNowMock();
    const service = new VerificationService(
      prisma as never,
      notifications as never,
      {} as never,
      {} as never,
      {} as never,
      { consume: jest.fn() } as never,
      indexNow as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      prisma.farm.updateMany.mockResolvedValue({ count: 1 });
      prisma.product.findMany.mockResolvedValue([{ id: 'product01' }]);
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm00001',
        verificationStatus: 'pending',
        name: 'Test Farm',
        owner: { id: 'u1', email: 'f@example.com', locale: 'en', displayName: 'Nino' },
      });
    });

    it('notifies the farm and its public products when the badge appears', async () => {
      await service.applyModeratorDecision({
        farmId: 'farm00001',
        adminId: 'admin1',
        approve: true,
        note: null,
      });
      await flush();

      expect(indexNow.submitFarm).toHaveBeenCalledWith('farm00001');
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');
    });

    it('does not notify when a pending farm is rejected', async () => {
      await service.applyModeratorDecision({
        farmId: 'farm00001',
        adminId: 'admin1',
        approve: false,
        note: 'Unreadable',
      });
      await flush();

      expect(indexNow.submitFarm).not.toHaveBeenCalled();
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('does not notify when an already approved farm is approved again', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm00001',
        verificationStatus: 'approved',
        name: 'Test Farm',
        owner: { id: 'u1', email: 'f@example.com', locale: 'en', displayName: 'Nino' },
      });
      prisma.farm.updateMany.mockResolvedValue({ count: 0 });

      await service.applyModeratorDecision({
        farmId: 'farm00001',
        adminId: 'admin1',
        approve: true,
        note: null,
      });
      await flush();

      expect(indexNow.submitFarm).not.toHaveBeenCalled();
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });
  });

  describe('completed catalog translations', () => {
    const prisma = {
      product: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      productTranslation: { upsert: jest.fn(), update: jest.fn() },
      purchaseRequest: { findUnique: jest.fn() },
      purchaseRequestTranslation: { upsert: jest.fn(), update: jest.fn() },
      farm: { findUnique: jest.fn(), update: jest.fn() },
      farmTranslation: { upsert: jest.fn(), update: jest.fn() },
    };
    const translation = {
      providerName: 'mock',
      translateText: jest.fn(),
    };
    const indexNow = indexNowMock();
    const service = new CatalogTranslationService(
      prisma as never,
      translation as never,
      indexNow as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      translation.translateText.mockResolvedValue({ translatedText: 'translated', provider: 'mock' });
      prisma.productTranslation.upsert.mockResolvedValue({});
      prisma.productTranslation.update.mockResolvedValue({});
      prisma.purchaseRequestTranslation.upsert.mockResolvedValue({});
      prisma.purchaseRequestTranslation.update.mockResolvedValue({});
      prisma.farmTranslation.upsert.mockResolvedValue({});
      prisma.farmTranslation.update.mockResolvedValue({});
      prisma.product.findMany.mockResolvedValue([{ id: 'product01' }]);
    });

    it('notifies a public product after a completed translation write', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'product01',
        title: 'ყურძენი',
        description: null,
        variety: null,
        originPlace: null,
        sourceLocale: LocaleCode.ka,
        isPublished: true,
        moderationStatus: 'approved',
        owner: { locale: LocaleCode.ka },
        translations: [],
      });

      await service.syncProduct('product01');

      expect(indexNow.submitProduct).toHaveBeenCalledTimes(1);
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');
    });

    it('does not notify when the translation fails', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'product01',
        title: 'ყურძენი',
        description: null,
        variety: null,
        originPlace: null,
        sourceLocale: LocaleCode.ka,
        isPublished: true,
        moderationStatus: 'approved',
        owner: { locale: LocaleCode.ka },
        translations: [],
      });
      translation.translateText.mockRejectedValue(new Error('provider down'));

      await service.syncProduct('product01');

      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('does not notify a draft product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'product01',
        title: 'ყურძენი',
        description: null,
        variety: null,
        originPlace: null,
        sourceLocale: LocaleCode.ka,
        isPublished: false,
        moderationStatus: 'draft',
        owner: { locale: LocaleCode.ka },
        translations: [],
      });

      await service.syncProduct('product01');

      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('notifies only the farm when a description translation is written', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm00001',
        description: 'საოჯახო მეურნეობა',
        history: null,
        ownershipType: null,
        exportMarkets: [],
        sourceLocale: LocaleCode.ka,
        owner: { locale: LocaleCode.ka },
        translations: [],
      });

      await service.syncFarm('farm00001');
      await flush();

      expect(indexNow.submitFarm).toHaveBeenCalledTimes(1);
      expect(indexNow.submitFarm).toHaveBeenCalledWith('farm00001');
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });

    it('notifies public products when a history translation is written', async () => {
      prisma.farm.findUnique.mockResolvedValue({
        id: 'farm00001',
        description: null,
        history: 'ისტორია',
        ownershipType: null,
        exportMarkets: [],
        sourceLocale: LocaleCode.ka,
        owner: { locale: LocaleCode.ka },
        translations: [],
      });

      await service.syncFarm('farm00001');
      await flush();

      expect(indexNow.submitFarm).toHaveBeenCalledWith('farm00001');
      expect(indexNow.submitProduct).toHaveBeenCalledWith('product01');
    });

    it('notifies an open purchase request after a completed translation write', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'request01',
        title: 'ყურძენი',
        variety: null,
        packaging: null,
        destinationCountry: null,
        message: null,
        status: 'open',
        sourceLocale: LocaleCode.ka,
        buyer: { locale: LocaleCode.ka },
        translations: [],
      });

      await service.syncPurchaseRequest('request01');

      expect(indexNow.submitPurchaseRequest).toHaveBeenCalledTimes(1);
      expect(indexNow.submitPurchaseRequest).toHaveBeenCalledWith('request01');
    });

    it('does not notify a closed purchase request', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'request01',
        title: 'ყურძენი',
        variety: null,
        packaging: null,
        destinationCountry: null,
        message: null,
        status: 'closed',
        sourceLocale: LocaleCode.ka,
        buyer: { locale: LocaleCode.ka },
        translations: [],
      });

      await service.syncPurchaseRequest('request01');

      expect(indexNow.submitPurchaseRequest).not.toHaveBeenCalled();
    });

    it('does not notify when completed translations already match', async () => {
      const hashFields = {
        title: 'ყურძენი',
        description: null,
        variety: null,
        originPlace: null,
      };
      const hash = productSourceHash(hashFields);
      prisma.product.findUnique.mockResolvedValue({
        id: 'product01',
        ...hashFields,
        sourceLocale: LocaleCode.ka,
        isPublished: true,
        moderationStatus: 'approved',
        owner: { locale: LocaleCode.ka },
        translations: ['en', 'ru', 'de', 'fr', 'it', 'es'].map((locale) => ({
          locale,
          status: MessageTranslationStatus.completed,
          sourceHash: hash,
          title: 'Grapes',
        })),
      });

      await service.syncProduct('product01');

      expect(translation.translateText).not.toHaveBeenCalled();
      expect(indexNow.submitProduct).not.toHaveBeenCalled();
    });
  });
});
