import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  FarmDetail,
  FarmDocument,
  FarmPhoto,
  FarmSummary,
  RatingSummary,
  VerificationStatus,
} from '@agrobridge/shared';
import {
  FARM_DOCUMENT_MAX_BYTES,
  FARM_DOCUMENT_MAX_COUNT,
  FARM_PHOTO_MAX_BYTES,
  FARM_PHOTO_MAX_COUNT,
  canTrade,
  isFarmDocumentKind,
  isFarmDocumentMimeType,
  isFarmPhotoMimeType,
} from '@agrobridge/shared';
import {
  DocumentReviewStatus,
  FarmDocumentKind,
  ModerationStatus as PrismaModerationStatus,
  VerificationStatus as PrismaVerificationStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from '../ratings/ratings.service';
import { StorageService } from '../storage/storage.service';
import {
  mapProductSummary,
  sanitizeStringArray,
  type ProductFarmSlice,
  type ProductRowSlice,
} from '../products/product-mapper';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

const publicProductWhere = {
  isPublished: true,
  moderationStatus: PrismaModerationStatus.approved,
};

const farmImagesInclude = {
  orderBy: [{ isPrimary: 'desc' as const }, { sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  select: {
    id: true,
    url: true,
    sortOrder: true,
    isPrimary: true,
  },
};

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratings: RatingsService,
    private readonly storage: StorageService,
  ) {}

  async list(): Promise<FarmSummary[]> {
    const farms = await this.prisma.farm.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { id: true, displayName: true } },
        images: farmImagesInclude,
        _count: {
          select: { products: { where: publicProductWhere } },
        },
      },
    });

    return farms.map((farm) => this.toSummary(farm));
  }

  async getById(id: string): Promise<FarmDetail> {
    const farm = await this.prisma.farm.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true } },
        images: farmImagesInclude,
        products: {
          where: publicProductWhere,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            ownerUserId: true,
            title: true,
            description: true,
            category: true,
            variety: true,
            country: true,
            originPlace: true,
            unit: true,
            minQuantity: true,
            maxQuantity: true,
            currentStock: true,
            monthlyProduction: true,
            maxAnnualProduction: true,
            seasonMonths: true,
            harvestStartAt: true,
            harvestEndAt: true,
            forecastQuantity: true,
            harvestStatus: true,
            preorderEnabled: true,
            attributes: true,
            packagingTypes: true,
            packagingWeights: true,
            palletSize: true,
            incoterms: true,
            carriers: true,
            customDelivery: true,
            nearestPort: true,
            deliveryAvailable: true,
            leadTimeDays: true,
            priceFrom: true,
            priceCurrency: true,
            priceNegotiable: true,
            priceDependsOnVolume: true,
            isPublished: true,
            moderationStatus: true,
            moderationNote: true,
            farmId: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                url: true,
                sortOrder: true,
                isPrimary: true,
                kind: true,
              },
            },
            videos: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                url: true,
                fileName: true,
                mimeType: true,
                durationSeconds: true,
                createdAt: true,
              },
            },
            certificates: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                type: true,
                title: true,
                fileName: true,
                url: true,
                mimeType: true,
                reviewStatus: true,
                reviewNote: true,
                createdAt: true,
              },
            },
          },
        },
        _count: {
          select: { products: { where: publicProductWhere } },
        },
      },
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const sellerRating = await this.ratings.summaryForUser(farm.owner.id);

    return {
      ...this.toSummary(farm),
      createdAt: farm.createdAt.toISOString(),
      verificationNote: null,
      verifiedAt: farm.verifiedAt?.toISOString() ?? null,
      products: farm.products.map((product) => this.toProductSummary(product, farm, sellerRating)),
    };
  }

  async getMine(user: AuthenticatedUser): Promise<FarmDetail | null> {
    this.assertFarmer(user);

    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      include: {
        owner: { select: { id: true, displayName: true } },
        images: farmImagesInclude,
        documents: { orderBy: { createdAt: 'desc' } },
        products: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            ownerUserId: true,
            title: true,
            description: true,
            category: true,
            variety: true,
            country: true,
            originPlace: true,
            unit: true,
            minQuantity: true,
            maxQuantity: true,
            currentStock: true,
            monthlyProduction: true,
            maxAnnualProduction: true,
            seasonMonths: true,
            harvestStartAt: true,
            harvestEndAt: true,
            forecastQuantity: true,
            harvestStatus: true,
            preorderEnabled: true,
            attributes: true,
            packagingTypes: true,
            packagingWeights: true,
            palletSize: true,
            incoterms: true,
            carriers: true,
            customDelivery: true,
            nearestPort: true,
            deliveryAvailable: true,
            leadTimeDays: true,
            priceFrom: true,
            priceCurrency: true,
            priceNegotiable: true,
            priceDependsOnVolume: true,
            isPublished: true,
            moderationStatus: true,
            moderationNote: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                url: true,
                sortOrder: true,
                isPrimary: true,
                kind: true,
              },
            },
            videos: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                url: true,
                fileName: true,
                mimeType: true,
                durationSeconds: true,
                createdAt: true,
              },
            },
            certificates: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                type: true,
                title: true,
                fileName: true,
                url: true,
                mimeType: true,
                reviewStatus: true,
                reviewNote: true,
                createdAt: true,
              },
            },
          },
        },
        _count: { select: { products: true } },
      },
    });

    if (!farm) {
      return null;
    }

    const sellerRating = await this.ratings.summaryForUser(farm.owner.id);

    return {
      ...this.toSummary(farm),
      createdAt: farm.createdAt.toISOString(),
      verificationNote: farm.verificationNote,
      verifiedAt: farm.verifiedAt?.toISOString() ?? null,
      companyRegistrationNumber: farm.companyRegistrationNumber,
      companyRegistryValid: farm.companyRegistryValid,
      documents: farm.documents.map((doc) => this.toDocument(doc)),
      products: farm.products.map((product) => this.toProductSummary(product, farm, sellerRating)),
    };
  }

  async create(user: AuthenticatedUser, dto: CreateFarmDto): Promise<FarmDetail> {
    this.assertFarmer(user);

    const existing = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (existing) {
      throw new ConflictException('Farm profile already exists');
    }

    const farm = await this.prisma.farm.create({
      data: {
        ownerId: user.id,
        name: dto.name.trim(),
        region: dto.region?.trim() || null,
        description: dto.description?.trim() || null,
        foundedYear: dto.foundedYear ?? null,
        farmSizeHectares: dto.farmSizeHectares ?? null,
        ownershipType: dto.ownershipType?.trim() || null,
        exportMarkets: sanitizeStringArray(dto.exportMarkets, 50),
        history: dto.history?.trim() || null,
        verificationStatus: PrismaVerificationStatus.unverified,
      },
    });

    // Attach existing listings so the optional farm profile enriches them.
    await this.prisma.product.updateMany({
      where: { ownerUserId: user.id, farmId: null },
      data: { farmId: farm.id },
    });
    await this.prisma.rfq.updateMany({
      where: { farmId: null, product: { ownerUserId: user.id } },
      data: { farmId: farm.id },
    });

    return (await this.getMine(user))!;
  }

  async updateMine(user: AuthenticatedUser, dto: UpdateFarmDto): Promise<FarmDetail> {
    this.assertFarmer(user);

    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      throw new NotFoundException('Farm profile not found');
    }

    await this.prisma.farm.update({
      where: { id: farm.id },
      data: {
        name: dto.name?.trim(),
        region: dto.region === undefined ? undefined : dto.region.trim() || null,
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        foundedYear: dto.foundedYear,
        farmSizeHectares: dto.farmSizeHectares,
        ownershipType:
          dto.ownershipType === undefined ? undefined : dto.ownershipType.trim() || null,
        exportMarkets:
          dto.exportMarkets === undefined ? undefined : sanitizeStringArray(dto.exportMarkets, 50),
        history: dto.history === undefined ? undefined : dto.history.trim() || null,
      },
    });

    return (await this.getMine(user))!;
  }

  async listMyDocuments(user: AuthenticatedUser): Promise<FarmDocument[]> {
    const farm = await this.requireOwnFarm(user);
    const docs = await this.prisma.farmDocument.findMany({
      where: { farmId: farm.id },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((doc) => this.toDocument(doc));
  }

  async uploadDocument(
    user: AuthenticatedUser,
    title: string,
    file?: Express.Multer.File,
    kindRaw?: string,
  ): Promise<FarmDocument> {
    const farm = await this.requireOwnFarm(user);
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!isFarmDocumentMimeType(file.mimetype)) {
      throw new BadRequestException('Unsupported document type');
    }
    if (file.size > FARM_DOCUMENT_MAX_BYTES) {
      throw new BadRequestException('Document is too large');
    }

    const kind = kindRaw && isFarmDocumentKind(kindRaw) ? kindRaw : ('other' as const);

    const count = await this.prisma.farmDocument.count({ where: { farmId: farm.id } });
    if (count >= FARM_DOCUMENT_MAX_COUNT) {
      throw new BadRequestException('Document limit reached');
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new BadRequestException('Document title is required');
    }

    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: `farms/${farm.id}/documents`,
    });

    const doc = await this.prisma.farmDocument.create({
      data: {
        farmId: farm.id,
        title: trimmedTitle,
        fileName: file.originalname,
        url: stored.url,
        key: stored.key,
        mimeType: file.mimetype,
        kind: kind as FarmDocumentKind,
        reviewStatus: DocumentReviewStatus.pending,
      },
    });

    return this.toDocument(doc);
  }

  async removeDocument(user: AuthenticatedUser, documentId: string): Promise<void> {
    const farm = await this.requireOwnFarm(user);
    const doc = await this.prisma.farmDocument.findFirst({
      where: { id: documentId, farmId: farm.id },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    await this.storage.delete(doc.key);
    await this.prisma.farmDocument.delete({ where: { id: doc.id } });
  }

  async uploadPhoto(
    user: AuthenticatedUser,
    file?: Express.Multer.File,
  ): Promise<FarmDetail> {
    const farm = await this.requireOwnFarm(user);
    if (!file) {
      throw new BadRequestException('Photo file is required');
    }
    if (!isFarmPhotoMimeType(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP photos are allowed');
    }
    if (file.size > FARM_PHOTO_MAX_BYTES) {
      throw new BadRequestException('Photo is too large');
    }

    const existingCount = await this.prisma.farmImage.count({ where: { farmId: farm.id } });
    if (existingCount >= FARM_PHOTO_MAX_COUNT) {
      throw new BadRequestException(`A farm can have at most ${FARM_PHOTO_MAX_COUNT} photos`);
    }

    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname || 'farm-photo',
      folder: `farms/${farm.id}/photos`,
    });

    const isPrimary = existingCount === 0;

    try {
      await this.prisma.farmImage.create({
        data: {
          farmId: farm.id,
          url: stored.url,
          key: stored.key,
          sortOrder: existingCount,
          isPrimary,
        },
      });
    } catch (error) {
      await this.storage.delete(stored.key).catch(() => undefined);
      throw error;
    }

    return (await this.getMine(user))!;
  }

  async removePhoto(user: AuthenticatedUser, photoId: string): Promise<FarmDetail> {
    const farm = await this.requireOwnFarm(user);
    const image = await this.prisma.farmImage.findFirst({
      where: { id: photoId, farmId: farm.id },
    });
    if (!image) {
      throw new NotFoundException('Photo not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.farmImage.delete({ where: { id: image.id } });

      if (image.isPrimary) {
        const next = await tx.farmImage.findFirst({
          where: { farmId: farm.id },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        if (next) {
          await tx.farmImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    await this.storage.delete(image.key).catch(() => undefined);

    return (await this.getMine(user))!;
  }

  async setPrimaryPhoto(user: AuthenticatedUser, photoId: string): Promise<FarmDetail> {
    const farm = await this.requireOwnFarm(user);
    const image = await this.prisma.farmImage.findFirst({
      where: { id: photoId, farmId: farm.id },
    });
    if (!image) {
      throw new NotFoundException('Photo not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.farmImage.updateMany({
        where: { farmId: farm.id, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.farmImage.update({
        where: { id: image.id },
        data: { isPrimary: true },
      });
    });

    return (await this.getMine(user))!;
  }

  private async requireOwnFarm(user: AuthenticatedUser) {
    this.assertFarmer(user);
    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      throw new NotFoundException('Farm profile not found');
    }
    return farm;
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (!canTrade(user.role)) {
      throw new ForbiddenException('Sign in to manage farm profiles');
    }
  }

  private toDocument(doc: {
    id: string;
    farmId: string;
    title: string;
    fileName: string;
    url: string;
    mimeType: string;
    kind: FarmDocumentKind;
    reviewStatus: DocumentReviewStatus;
    reviewNote: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }): FarmDocument {
    return {
      id: doc.id,
      farmId: doc.farmId,
      title: doc.title,
      fileName: doc.fileName,
      url: doc.url,
      mimeType: doc.mimeType,
      kind: doc.kind,
      reviewStatus: doc.reviewStatus,
      reviewNote: doc.reviewNote,
      reviewedAt: doc.reviewedAt?.toISOString() ?? null,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private toPhoto(image: {
    id: string;
    url: string;
    sortOrder: number;
    isPrimary: boolean;
  }): FarmPhoto {
    return {
      id: image.id,
      url: image.url,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
    };
  }

  private toSummary(farm: {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    foundedYear: number | null;
    farmSizeHectares: { toNumber(): number } | number | null;
    ownershipType: string | null;
    exportMarkets: string[];
    history: string | null;
    verificationStatus: PrismaVerificationStatus;
    owner: { id: string; displayName: string | null };
    images?: Array<{
      id: string;
      url: string;
      sortOrder: number;
      isPrimary: boolean;
    }>;
    _count: { products: number };
  }): FarmSummary {
    const verificationStatus = farm.verificationStatus as VerificationStatus;
    return {
      id: farm.id,
      name: farm.name,
      region: farm.region,
      description: farm.description,
      foundedYear: farm.foundedYear,
      farmSizeHectares:
        farm.farmSizeHectares == null
          ? null
          : typeof farm.farmSizeHectares === 'number'
            ? farm.farmSizeHectares
            : farm.farmSizeHectares.toNumber(),
      ownershipType: farm.ownershipType,
      exportMarkets: farm.exportMarkets,
      history: farm.history,
      verificationStatus,
      verified: verificationStatus === 'approved',
      owner: farm.owner,
      productCount: farm._count.products,
      photos: (farm.images ?? []).map((image) => this.toPhoto(image)),
    };
  }

  private toProductSummary(
    product: Omit<ProductRowSlice, 'farm' | 'owner'>,
    farm: ProductFarmSlice & { owner: { id: string; displayName: string | null } },
    sellerRating?: RatingSummary | null,
  ) {
    return mapProductSummary(
      {
        ...product,
        owner: farm.owner,
        farm,
      },
      sellerRating,
    );
  }
}
