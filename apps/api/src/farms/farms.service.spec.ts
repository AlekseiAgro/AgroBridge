import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FarmsService } from './farms.service';

describe('FarmsService', () => {
  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const prisma = {
    farm: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    farmImage: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    farmDocument: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    rfq: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
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
      storage as never,
    );
  });

  it('links existing products when a farm profile is created', async () => {
    prisma.farm.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'farm1',
        ownerId: 'u1',
        name: 'Test Farm',
        region: null,
        description: null,
        foundedYear: null,
        farmSizeHectares: null,
        ownershipType: null,
        exportMarkets: [],
        history: null,
        verificationStatus: 'unverified',
        verificationNote: null,
        verifiedAt: null,
        companyRegistrationNumber: null,
        companyRegistryValid: null,
        createdAt: new Date(),
        owner: { id: 'u1', displayName: 'Nino' },
        documents: [],
        images: [],
        products: [],
        _count: { products: 0 },
      });
    prisma.farm.create.mockResolvedValue({ id: 'farm1' });
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.rfq.updateMany.mockResolvedValue({ count: 0 });

    await service.create(
      {
        id: 'u1',
        email: 'f@example.com',
        role: 'farmer',
        locale: 'ka',
        displayName: 'Nino',
      },
      { name: 'Test Farm' },
    );

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { ownerUserId: 'u1', farmId: null },
      data: { farmId: 'farm1' },
    });
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

  it('rejects a fourth farm photo', async () => {
    prisma.farm.findUnique.mockResolvedValue({ id: 'farm1', ownerId: 'u1' });
    prisma.farmImage.count.mockResolvedValue(3);

    await expect(
      service.uploadPhoto(
        {
          id: 'u1',
          email: 'f@example.com',
          role: 'farmer',
          locale: 'ka',
          displayName: 'Nino',
        },
        {
          buffer: Buffer.from('img'),
          mimetype: 'image/jpeg',
          originalname: 'farm.jpg',
          size: 1024,
        } as Express.Multer.File,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('uploads farm photos as public media', async () => {
    prisma.farm.findUnique.mockResolvedValue({ id: 'farm1', ownerId: 'u1' });
    prisma.farmImage.count.mockResolvedValue(0);
    storage.upload.mockResolvedValue({
      key: 'farms/farm1/photos/a.jpg',
      url: '/api/uploads/farms/farm1/photos/a.jpg',
    });
    prisma.farmImage.create.mockResolvedValue({ id: 'photo1' });
    prisma.farm.findUnique
      .mockResolvedValueOnce({ id: 'farm1', ownerId: 'u1' })
      .mockResolvedValueOnce({
        id: 'farm1',
        ownerId: 'u1',
        name: 'Test Farm',
        region: null,
        description: null,
        foundedYear: null,
        farmSizeHectares: null,
        ownershipType: null,
        exportMarkets: [],
        history: null,
        verificationStatus: 'unverified',
        verificationNote: null,
        verifiedAt: null,
        companyRegistrationNumber: null,
        companyRegistryValid: null,
        createdAt: new Date(),
        owner: { id: 'u1', displayName: 'Nino' },
        documents: [],
        images: [],
        products: [],
        _count: { products: 0 },
      });

    await service.uploadPhoto(
      {
        id: 'u1',
        email: 'f@example.com',
        role: 'farmer',
        locale: 'ka',
        displayName: 'Nino',
      } as AuthenticatedUser,
      {
        buffer: Buffer.from('img'),
        mimetype: 'image/jpeg',
        originalname: 'farm.jpg',
        size: 1024,
      } as Express.Multer.File,
    );

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'farms/farm1/photos',
        visibility: 'public',
      }),
    );
  });

  describe('getDocumentDownload', () => {
    const storedDocument = {
      key: 'farms/farm1/documents/9f0e.bin',
      fileName: 'id-card.pdf',
      mimeType: 'application/pdf',
      farm: { ownerId: 'owner1' },
    };

    const user = (id: string, role: AuthenticatedUser['role']): AuthenticatedUser =>
      ({ id, email: `${id}@example.com`, role, locale: 'en' }) as AuthenticatedUser;

    it('returns the stored key for the farm owner', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue(storedDocument);

      await expect(service.getDocumentDownload(user('owner1', 'farmer'), 'doc1')).resolves.toEqual({
        key: storedDocument.key,
        fileName: storedDocument.fileName,
        mimeType: storedDocument.mimeType,
      });
    });

    it('returns the stored key for an admin', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue(storedDocument);

      await expect(
        service.getDocumentDownload(user('admin1', 'admin'), 'doc1'),
      ).resolves.toMatchObject({ key: storedDocument.key });
    });

    it('denies a farmer who owns a different farm', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue(storedDocument);

      await expect(
        service.getDocumentDownload(user('farmer2', 'farmer'), 'doc1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies a buyer', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue(storedDocument);

      await expect(
        service.getDocumentDownload(user('buyer1', 'buyer'), 'doc1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('denies an unknown document with the same error as an unauthorized one', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue(null);

      await expect(
        service.getDocumentDownload(user('owner1', 'farmer'), 'missing'),
      ).rejects.toThrow('Document not found');
    });

    it('never derives the storage key from the requested id', async () => {
      prisma.farmDocument.findUnique.mockResolvedValue(storedDocument);

      const result = await service.getDocumentDownload(
        user('owner1', 'farmer'),
        '../../../etc/passwd',
      );

      expect(result.key).toBe(storedDocument.key);
      expect(prisma.farmDocument.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '../../../etc/passwd' } }),
      );
    });
  });

  it('exposes documents through the private download path, not the storage url', async () => {
    prisma.farm.findUnique.mockResolvedValue({ id: 'farm1', ownerId: 'u1' });
    prisma.farmDocument.findMany.mockResolvedValue([
      {
        id: 'doc1',
        farmId: 'farm1',
        title: 'ID card',
        fileName: 'id.pdf',
        url: '/api/uploads/farms/farm1/documents/9f0e.bin',
        key: 'farms/farm1/documents/9f0e.bin',
        mimeType: 'application/pdf',
        kind: 'idCard',
        reviewStatus: 'pending',
        reviewNote: null,
        reviewedAt: null,
        createdAt: new Date(),
      },
    ]);

    const [document] = await service.listMyDocuments({
      id: 'u1',
      email: 'f@example.com',
      role: 'farmer',
      locale: 'ka',
      displayName: 'Nino',
    } as AuthenticatedUser);

    expect(document.url).toBe('/api/farms/documents/doc1/file');
    expect(document.url).not.toContain('/api/uploads/');
  });

  it('uploads verification documents as private objects without a public storage url', async () => {
    prisma.farm.findUnique.mockResolvedValue({ id: 'farm1', ownerId: 'u1' });
    prisma.farmDocument.count.mockResolvedValue(0);
    storage.upload.mockResolvedValue({
      key: 'farms/farm1/documents/abc.pdf',
      url: '',
    });
    const created = {
      id: 'doc1',
      farmId: 'farm1',
      title: 'ID card',
      fileName: 'id.pdf',
      url: '',
      key: 'farms/farm1/documents/abc.pdf',
      mimeType: 'application/pdf',
      kind: 'idCard',
      reviewStatus: 'pending',
      reviewNote: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    prisma.farmDocument.create.mockResolvedValue(created);

    const document = await service.uploadDocument(
      {
        id: 'u1',
        email: 'f@example.com',
        role: 'farmer',
        locale: 'ka',
        displayName: 'Nino',
      } as AuthenticatedUser,
      'ID card',
      {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        originalname: 'id.pdf',
        size: 1024,
      } as Express.Multer.File,
      'idCard',
    );

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'farms/farm1/documents',
        visibility: 'private',
      }),
    );
    expect(prisma.farmDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: '',
          key: 'farms/farm1/documents/abc.pdf',
        }),
      }),
    );
    expect(document.url).toBe('/api/farms/documents/doc1/file');
    expect(document.url).not.toContain('/api/uploads/');
  });

  it('deletes verification documents from private storage', async () => {
    prisma.farm.findUnique.mockResolvedValue({ id: 'farm1', ownerId: 'u1' });
    prisma.farmDocument.findFirst.mockResolvedValue({
      id: 'doc1',
      farmId: 'farm1',
      key: 'farms/farm1/documents/abc.pdf',
    });
    prisma.farmDocument.delete.mockResolvedValue({});

    await service.removeDocument(
      {
        id: 'u1',
        email: 'f@example.com',
        role: 'farmer',
        locale: 'ka',
        displayName: 'Nino',
      } as AuthenticatedUser,
      'doc1',
    );

    expect(storage.delete).toHaveBeenCalledWith(
      'farms/farm1/documents/abc.pdf',
      'private',
    );
    expect(prisma.farmDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc1' } });
  });
});
