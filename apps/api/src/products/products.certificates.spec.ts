import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import type { AuthenticatedUser } from '../auth/auth.types';

const owner: AuthenticatedUser = {
  id: 'owner1',
  email: 'owner@example.com',
  role: 'farmer',
  sellerType: 'privateFarmer',
  buyerType: null,
  locale: 'en',
  displayName: 'Owner',
  avatarUrl: null,
  emailVerified: true,
};

const stranger: AuthenticatedUser = {
  ...owner,
  id: 'stranger1',
  email: 'other@example.com',
  displayName: 'Other',
};

const admin: AuthenticatedUser = {
  ...owner,
  id: 'admin1',
  email: 'admin@example.com',
  role: 'admin',
  displayName: 'Admin',
};

describe('ProductsService certificate authorization', () => {
  const prisma = {
    farm: { findUnique: jest.fn() },
    product: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    productCertificate: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    harvestWatch: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const storage = {
    upload: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductsService(
      prisma as never,
      storage as never,
      {
        summaryForUser: jest.fn().mockResolvedValue({ average: null, count: 0 }),
        summariesForUsers: jest.fn().mockResolvedValue(new Map()),
      } as never,
      { enabledIds: jest.fn().mockResolvedValue(null) } as never,
      { notifyProductPendingModeration: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  describe('getCertificateDownload', () => {
    const approvedPublic = {
      key: 'products/p1/certificates/a.pdf',
      fileName: 'gap.pdf',
      mimeType: 'application/pdf',
      reviewStatus: 'approved',
      product: {
        ownerUserId: owner.id,
        isPublished: true,
        moderationStatus: 'approved',
      },
    };

    const pending = {
      ...approvedPublic,
      key: 'products/p1/certificates/p.pdf',
      reviewStatus: 'pending',
    };

    it('lets anyone download an approved certificate on a public listing', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(approvedPublic);
      await expect(service.getCertificateDownload('p1', 'c1', null)).resolves.toEqual({
        key: approvedPublic.key,
        fileName: 'gap.pdf',
        mimeType: 'application/pdf',
      });
    });

    it('returns 401 for an unauthenticated pending certificate', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(pending);
      await expect(service.getCertificateDownload('p1', 'c1', null)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('lets the owner download a pending certificate', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(pending);
      await expect(service.getCertificateDownload('p1', 'c1', owner)).resolves.toMatchObject({
        key: pending.key,
      });
    });

    it('lets an admin download a pending certificate', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(pending);
      await expect(service.getCertificateDownload('p1', 'c1', admin)).resolves.toMatchObject({
        key: pending.key,
      });
    });

    it('does not let an unrelated user download a pending certificate', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(pending);
      await expect(service.getCertificateDownload('p1', 'c1', stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not probe missing ids', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(null);
      await expect(service.getCertificateDownload('p1', 'guessed', owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not find a certificate on the wrong product', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(null);
      await expect(service.getCertificateDownload('other-product', 'c1', owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.productCertificate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1', productId: 'other-product' },
        }),
      );
    });

    it('rejects an unverified owner for a private certificate', async () => {
      prisma.productCertificate.findFirst.mockResolvedValue(pending);
      await expect(
        service.getCertificateDownload('p1', 'c1', { ...owner, emailVerified: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('treats a rejected certificate as private', async () => {
      const rejected = { ...pending, reviewStatus: 'rejected' };
      prisma.productCertificate.findFirst.mockResolvedValue(rejected);
      await expect(service.getCertificateDownload('p1', 'c1', null)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(service.getCertificateDownload('p1', 'c1', stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.getCertificateDownload('p1', 'c1', owner)).resolves.toMatchObject({
        key: rejected.key,
      });
    });
  });

  describe('getById certificate visibility', () => {
    const publicProduct = {
      id: 'p1',
      ownerUserId: owner.id,
      title: 'Hazelnuts',
      description: null,
      category: null,
      variety: null,
      country: null,
      originPlace: null,
      unit: null,
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
      priceFrom: null,
      priceCurrency: null,
      priceNegotiable: false,
      priceDependsOnVolume: false,
      isPublished: true,
      moderationStatus: 'approved',
      moderationNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      images: [],
      videos: [],
      certificates: [
        {
          id: 'c-pending',
          type: 'organic',
          title: 'Pending organic',
          fileName: 'pending.pdf',
          url: 'https://cdn.example.com/secret.pdf',
          mimeType: 'application/pdf',
          reviewStatus: 'pending',
          reviewNote: 'waiting',
          createdAt: new Date(),
        },
        {
          id: 'c-approved',
          type: 'globalGap',
          title: 'GAP',
          fileName: 'gap.pdf',
          url: 'https://cdn.example.com/gap.pdf',
          mimeType: 'application/pdf',
          reviewStatus: 'approved',
          reviewNote: null,
          createdAt: new Date(),
        },
        {
          id: 'c-rejected',
          type: 'other',
          title: 'Rejected',
          fileName: 'nope.pdf',
          url: 'https://cdn.example.com/nope.pdf',
          mimeType: 'application/pdf',
          reviewStatus: 'rejected',
          reviewNote: 'blurry',
          createdAt: new Date(),
        },
      ],
      owner: { id: owner.id, displayName: 'Owner' },
      farm: null,
    };

    it('hides pending and rejected certificates from public product JSON', async () => {
      prisma.product.findUnique.mockResolvedValue(publicProduct);
      const detail = await service.getById('p1', null);
      expect(detail.certificates.map((cert) => cert.id)).toEqual(['c-approved']);
      expect(detail.certificates[0].url).toBe('/api/products/p1/certificates/c-approved/file');
      expect(JSON.stringify(detail)).not.toContain('waiting');
      expect(JSON.stringify(detail)).not.toContain('blurry');
      expect(JSON.stringify(detail)).not.toContain('cdn.example.com');
    });

    it('does not leak pending certificates to an unrelated authenticated user', async () => {
      prisma.product.findUnique.mockResolvedValue(publicProduct);
      const detail = await service.getById('p1', stranger);
      expect(detail.certificates.map((cert) => cert.id)).toEqual(['c-approved']);
    });

    it('lets the owner see pending and rejected certificates on their product', async () => {
      prisma.product.findUnique.mockResolvedValue(publicProduct);
      const detail = await service.getById('p1', owner);
      expect(detail.certificates.map((cert) => cert.id)).toEqual([
        'c-pending',
        'c-approved',
        'c-rejected',
      ]);
      expect(detail.certificates[0].reviewNote).toBe('waiting');
    });
  });

  describe('addCertificate / removeCertificate', () => {
    const ownedProduct = {
      id: 'p1',
      ownerUserId: owner.id,
      isPublished: false,
      moderationStatus: 'draft',
      farm: null,
      owner: { id: owner.id, displayName: 'Owner' },
    };

    it('uploads to private storage for the owner', async () => {
      prisma.product.findUnique.mockResolvedValue(ownedProduct);
      prisma.productCertificate.count.mockResolvedValue(0);
      storage.upload.mockResolvedValue({
        key: 'products/p1/certificates/uuid.pdf',
        url: '',
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        await fn({
          productCertificate: { create: jest.fn() },
          product: { update: jest.fn() },
        });
        return false;
      });
      prisma.product.findUnique.mockResolvedValueOnce(ownedProduct).mockResolvedValueOnce({
        ...ownedProduct,
        title: 'Hazelnuts',
        description: null,
        category: null,
        variety: null,
        country: null,
        originPlace: null,
        unit: null,
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
        priceFrom: null,
        priceCurrency: null,
        priceNegotiable: false,
        priceDependsOnVolume: false,
        moderationNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
        videos: [],
        certificates: [],
      });

      await service.addCertificate(owner, 'p1', 'organic', 'Organic 2026', {
        buffer: Buffer.from('%PDF'),
        mimetype: 'application/pdf',
        originalname: 'organic.pdf',
        size: 1200,
      } as Express.Multer.File);

      expect(storage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'products/p1/certificates',
          visibility: 'private',
        }),
      );
    });

    it('does not let a stranger attach a certificate to someone else\'s product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...ownedProduct,
        ownerUserId: owner.id,
      });
      await expect(
        service.addCertificate(stranger, 'p1', 'organic', 'Organic', {
          buffer: Buffer.from('%PDF'),
          mimetype: 'application/pdf',
          originalname: 'organic.pdf',
          size: 1200,
        } as Express.Multer.File),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('does not let a stranger delete someone else\'s certificate', async () => {
      prisma.product.findUnique.mockResolvedValue(ownedProduct);
      await expect(service.removeCertificate(stranger, 'p1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes the owner certificate from private storage', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(ownedProduct)
        .mockResolvedValueOnce({
          ...ownedProduct,
          title: 'Hazelnuts',
          description: null,
          category: null,
          variety: null,
          country: null,
          originPlace: null,
          unit: null,
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
          priceFrom: null,
          priceCurrency: null,
          priceNegotiable: false,
          priceDependsOnVolume: false,
          moderationNote: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          images: [],
          videos: [],
          certificates: [],
        });
      prisma.productCertificate.findFirst.mockResolvedValue({
        id: 'c1',
        key: 'products/p1/certificates/a.pdf',
      });
      prisma.$transaction.mockResolvedValue(false);

      await service.removeCertificate(owner, 'p1', 'c1');
      expect(storage.delete).toHaveBeenCalledWith('products/p1/certificates/a.pdf', 'private');
    });
  });
});
