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
  FarmSummary,
  ModerationStatus,
  RatingSummary,
  VerificationStatus,
} from '@agrobridge/shared';
import {
  FARM_DOCUMENT_MAX_BYTES,
  FARM_DOCUMENT_MAX_COUNT,
  isFarmDocumentKind,
  isFarmDocumentMimeType,
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
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

const publicProductWhere = {
  isPublished: true,
  moderationStatus: PrismaModerationStatus.approved,
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
        products: {
          where: publicProductWhere,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            unit: true,
            minQuantity: true,
            maxQuantity: true,
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
      products: farm.products.map((product) =>
        this.toProductSummary(product, farm, sellerRating),
      ),
    };
  }

  async getMine(user: AuthenticatedUser): Promise<FarmDetail | null> {
    this.assertFarmer(user);

    const farm = await this.prisma.farm.findUnique({
      where: { ownerId: user.id },
      include: {
        owner: { select: { id: true, displayName: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        products: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            unit: true,
            minQuantity: true,
            maxQuantity: true,
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
      products: farm.products.map((product) =>
        this.toProductSummary(product, farm, sellerRating),
      ),
    };
  }

  async create(user: AuthenticatedUser, dto: CreateFarmDto): Promise<FarmDetail> {
    this.assertFarmer(user);

    const existing = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (existing) {
      throw new ConflictException('Farm profile already exists');
    }

    await this.prisma.farm.create({
      data: {
        ownerId: user.id,
        name: dto.name.trim(),
        region: dto.region?.trim() || null,
        description: dto.description?.trim() || null,
        verificationStatus: PrismaVerificationStatus.unverified,
      },
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
        description:
          dto.description === undefined ? undefined : dto.description.trim() || null,
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

    const kind =
      kindRaw && isFarmDocumentKind(kindRaw) ? kindRaw : ('other' as const);

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

  private async requireOwnFarm(user: AuthenticatedUser) {
    this.assertFarmer(user);
    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      throw new NotFoundException('Farm profile not found');
    }
    return farm;
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (user.role !== 'farmer' && user.role !== 'admin') {
      throw new ForbiddenException('Only farmers can manage farm profiles');
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

  private toSummary(farm: {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    verificationStatus: PrismaVerificationStatus;
    owner: { id: string; displayName: string | null };
    _count: { products: number };
  }): FarmSummary {
    const verificationStatus = farm.verificationStatus as VerificationStatus;
    return {
      id: farm.id,
      name: farm.name,
      region: farm.region,
      description: farm.description,
      verificationStatus,
      verified: verificationStatus === 'approved',
      owner: farm.owner,
      productCount: farm._count.products,
    };
  }

  private toProductSummary(
    product: {
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      unit: string | null;
      minQuantity: { toNumber(): number } | number | null;
      maxQuantity: { toNumber(): number } | number | null;
      isPublished: boolean;
      moderationStatus: ModerationStatus | string;
      moderationNote: string | null;
      images: Array<{
        id: string;
        url: string;
        sortOrder: number;
        isPrimary: boolean;
      }>;
    },
    farm: {
      id: string;
      name: string;
      region: string | null;
      verificationStatus?: PrismaVerificationStatus | VerificationStatus;
    },
    sellerRating?: RatingSummary | null,
  ) {
    const verificationStatus = (farm.verificationStatus ??
      'unverified') as VerificationStatus;
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      category: product.category,
      unit: product.unit,
      minQuantity:
        product.minQuantity == null
          ? null
          : typeof product.minQuantity === 'number'
            ? product.minQuantity
            : product.minQuantity.toNumber(),
      maxQuantity:
        product.maxQuantity == null
          ? null
          : typeof product.maxQuantity === 'number'
            ? product.maxQuantity
            : product.maxQuantity.toNumber(),
      isPublished: product.isPublished,
      moderationStatus: product.moderationStatus as ModerationStatus,
      moderationNote: product.moderationNote,
      images: product.images,
      farm: {
        id: farm.id,
        name: farm.name,
        region: farm.region,
        verificationStatus,
        verified: verificationStatus === 'approved',
        sellerRating: sellerRating ?? { average: null, count: 0 },
      },
    };
  }
}
