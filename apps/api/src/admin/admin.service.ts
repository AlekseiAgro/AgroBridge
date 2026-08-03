import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminDeal,
  AdminFarm,
  AdminPurchaseRequest,
  AdminStats,
  AdminUser,
  CategoryConfigItem,
  FarmDocument,
  ModeratedProduct,
  ModerationStatus,
  VerificationStatus,
} from '@agrobridge/shared';
import {
  PRODUCT_CATEGORIES,
  mergeCategoryConfigs,
} from '@agrobridge/shared';
import {
  DocumentReviewStatus,
  ModerationStatus as PrismaModerationStatus,
  PurchaseRequestStatus,
  RfqStatus,
  UserRole,
  VerificationStatus as PrismaVerificationStatus,
} from '@prisma/client';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { VerificationService } from '../verification/verification.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BlockUserDto, RejectProductDto, ReviewNoteDto, UpdateCategoryDto } from './dto/admin.dto';

const farmOwnerInclude = {
  farm: {
    select: {
      id: true,
      name: true,
      region: true,
      owner: {
        select: {
          id: true,
          displayName: true,
          email: true,
          locale: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly verification: VerificationService,
  ) {}

  async stats(): Promise<AdminStats> {
    const now = new Date();
    const day7 = new Date(now);
    day7.setUTCDate(day7.getUTCDate() - 7);
    const day30 = new Date(now);
    day30.setUTCDate(day30.getUTCDate() - 30);
    const day14 = new Date(now);
    day14.setUTCDate(day14.getUTCDate() - 13);
    day14.setUTCHours(0, 0, 0, 0);

    const [
      productsPending,
      productsApproved,
      productsRejected,
      farmsTotal,
      farmsPendingVerification,
      farmsVerified,
      usersTotal,
      usersBuyers,
      usersFarmers,
      usersBlocked,
      registrationsLast7Days,
      registrationsLast30Days,
      dealsCompleted,
      dealsInProgress,
      purchaseRequestsOpen,
      purchaseRequestsFulfilled,
      documentsPending,
      recentUsers,
    ] = await Promise.all([
      this.prisma.product.count({
        where: { moderationStatus: PrismaModerationStatus.pending },
      }),
      this.prisma.product.count({
        where: { moderationStatus: PrismaModerationStatus.approved },
      }),
      this.prisma.product.count({
        where: { moderationStatus: PrismaModerationStatus.rejected },
      }),
      this.prisma.farm.count(),
      this.prisma.farm.count({
        where: { verificationStatus: PrismaVerificationStatus.pending },
      }),
      this.prisma.farm.count({
        where: { verificationStatus: PrismaVerificationStatus.approved },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.buyer } }),
      this.prisma.user.count({ where: { role: UserRole.farmer } }),
      this.prisma.user.count({ where: { blockedAt: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: day7 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: day30 } } }),
      this.prisma.rfq.count({ where: { status: RfqStatus.completed } }),
      this.prisma.rfq.count({ where: { status: RfqStatus.accepted } }),
      this.prisma.purchaseRequest.count({
        where: { status: PurchaseRequestStatus.open },
      }),
      this.prisma.purchaseRequest.count({
        where: { status: PurchaseRequestStatus.fulfilled },
      }),
      this.prisma.farmDocument.count({
        where: { reviewStatus: DocumentReviewStatus.pending },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: day14 } },
        select: { createdAt: true },
      }),
    ]);

    const byDay = new Map<string, number>();
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(day14);
      d.setUTCDate(day14.getUTCDate() + i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const user of recentUsers) {
      const key = user.createdAt.toISOString().slice(0, 10);
      if (byDay.has(key)) {
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
    }

    return {
      productsPending,
      productsApproved,
      productsRejected,
      farmsTotal,
      farmsPendingVerification,
      farmsVerified,
      usersTotal,
      usersBuyers,
      usersFarmers,
      usersBlocked,
      registrationsLast7Days,
      registrationsLast30Days,
      dealsCompleted,
      dealsInProgress,
      purchaseRequestsOpen,
      purchaseRequestsFulfilled,
      documentsPending,
      registrationsByDay: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    };
  }

  async listProducts(status?: string): Promise<ModeratedProduct[]> {
    const where =
      status && Object.values(PrismaModerationStatus).includes(status as PrismaModerationStatus)
        ? { moderationStatus: status as PrismaModerationStatus }
        : { moderationStatus: PrismaModerationStatus.pending };

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: farmOwnerInclude,
    });

    return products.map((product) => this.toModerated(product));
  }

  async approve(user: AuthenticatedUser, id: string): Promise<ModeratedProduct> {
    await this.requireProduct(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        moderationStatus: PrismaModerationStatus.approved,
        moderationNote: null,
        moderatedAt: new Date(),
        moderatedById: user.id,
        isPublished: true,
      },
      include: farmOwnerInclude,
    });

    await this.notifications.notifyProductApproved({
      farmer: product.farm.owner,
      productTitle: product.title,
      productId: product.id,
    });

    await this.subscriptions.notifyNewProduct({
      productId: product.id,
      productTitle: product.title,
      category: product.category,
      region: product.farm.region,
      farmName: product.farm.name,
      ownerUserId: product.farm.owner.id,
    });

    return this.toModerated(product);
  }

  async reject(
    user: AuthenticatedUser,
    id: string,
    dto: RejectProductDto,
  ): Promise<ModeratedProduct> {
    await this.requireProduct(id);

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        moderationStatus: PrismaModerationStatus.rejected,
        moderationNote: dto.note?.trim() || 'Rejected by moderator',
        moderatedAt: new Date(),
        moderatedById: user.id,
      },
      include: farmOwnerInclude,
    });

    await this.notifications.notifyProductRejected({
      farmer: product.farm.owner,
      productTitle: product.title,
      productId: product.id,
      note: product.moderationNote ?? 'Rejected by moderator',
    });

    return this.toModerated(product);
  }

  async listUsers(params?: {
    role?: string;
    blocked?: string;
    q?: string;
  }): Promise<AdminUser[]> {
    const role =
      params?.role && Object.values(UserRole).includes(params.role as UserRole)
        ? (params.role as UserRole)
        : undefined;
    const blocked =
      params?.blocked === 'true' ? true : params?.blocked === 'false' ? false : undefined;
    const q = params?.q?.trim();

    const users = await this.prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(blocked === true
          ? { blockedAt: { not: null } }
          : blocked === false
            ? { blockedAt: null }
            : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        farm: {
          select: { id: true, name: true, verificationStatus: true },
        },
      },
    });

    const dealCounts = await this.prisma.rfq.groupBy({
      by: ['buyerId'],
      where: {
        status: RfqStatus.completed,
        buyerId: { in: users.map((u) => u.id) },
      },
      _count: { _all: true },
    });
    const sellerDealCounts = await this.prisma.rfq.groupBy({
      by: ['farmId'],
      where: {
        status: RfqStatus.completed,
        farmId: { in: users.map((u) => u.farm?.id).filter(Boolean) as string[] },
      },
      _count: { _all: true },
    });

    const buyerDeals = new Map(dealCounts.map((row) => [row.buyerId, row._count._all]));
    const farmDeals = new Map(sellerDealCounts.map((row) => [row.farmId, row._count._all]));

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      locale: user.locale,
      createdAt: user.createdAt.toISOString(),
      blockedAt: user.blockedAt?.toISOString() ?? null,
      blockedReason: user.blockedReason,
      farm: user.farm
        ? {
            id: user.farm.id,
            name: user.farm.name,
            verificationStatus: user.farm.verificationStatus as VerificationStatus,
          }
        : null,
      completedDeals:
        (buyerDeals.get(user.id) ?? 0) +
        (user.farm ? (farmDeals.get(user.farm.id) ?? 0) : 0),
    }));
  }

  async blockUser(
    admin: AuthenticatedUser,
    id: string,
    dto: BlockUserDto,
  ): Promise<AdminUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { farm: { select: { id: true, name: true, verificationStatus: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role === UserRole.admin) {
      throw new ForbiddenException('Cannot block an administrator');
    }
    if (user.id === admin.id) {
      throw new BadRequestException('Cannot block yourself');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        blockedAt: new Date(),
        blockedReason: dto.reason?.trim() || 'Blocked by administrator',
        blockedById: admin.id,
      },
      include: { farm: { select: { id: true, name: true, verificationStatus: true } } },
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      displayName: updated.displayName,
      locale: updated.locale,
      createdAt: updated.createdAt.toISOString(),
      blockedAt: updated.blockedAt?.toISOString() ?? null,
      blockedReason: updated.blockedReason,
      farm: updated.farm
        ? {
            id: updated.farm.id,
            name: updated.farm.name,
            verificationStatus: updated.farm.verificationStatus as VerificationStatus,
          }
        : null,
      completedDeals: 0,
    };
  }

  async unblockUser(id: string): Promise<AdminUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { farm: { select: { id: true, name: true, verificationStatus: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        blockedAt: null,
        blockedReason: null,
        blockedById: null,
      },
      include: { farm: { select: { id: true, name: true, verificationStatus: true } } },
    });

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      displayName: updated.displayName,
      locale: updated.locale,
      createdAt: updated.createdAt.toISOString(),
      blockedAt: null,
      blockedReason: null,
      farm: updated.farm
        ? {
            id: updated.farm.id,
            name: updated.farm.name,
            verificationStatus: updated.farm.verificationStatus as VerificationStatus,
          }
        : null,
      completedDeals: 0,
    };
  }

  async listFarms(status?: string): Promise<AdminFarm[]> {
    const verificationStatus =
      status &&
      Object.values(PrismaVerificationStatus).includes(status as PrismaVerificationStatus)
        ? (status as PrismaVerificationStatus)
        : undefined;

    const farms = await this.prisma.farm.findMany({
      where: verificationStatus ? { verificationStatus } : undefined,
      orderBy: [{ verificationStatus: 'asc' }, { updatedAt: 'desc' }],
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
            blockedAt: true,
          },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { products: true } },
      },
    });

    return farms.map((farm) => this.toAdminFarm(farm));
  }

  async verifyFarm(
    admin: AuthenticatedUser,
    id: string,
    approve: boolean,
    dto: ReviewNoteDto,
  ): Promise<AdminFarm> {
    const existing = await this.prisma.farm.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Farm not found');
    }

    const farm = await this.prisma.farm.update({
      where: { id },
      data: approve
        ? {
            verificationStatus: PrismaVerificationStatus.approved,
            verificationNote: dto.note?.trim() || null,
            verifiedAt: new Date(),
            verifiedById: admin.id,
          }
        : {
            verificationStatus: PrismaVerificationStatus.rejected,
            verificationNote: dto.note?.trim() || 'Verification rejected',
            verifiedAt: null,
            verifiedById: admin.id,
          },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            displayName: true,
            blockedAt: true,
          },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { products: true } },
      },
    });

    return this.toAdminFarm(farm);
  }

  async reviewDocument(
    admin: AuthenticatedUser,
    documentId: string,
    approve: boolean,
    dto: ReviewNoteDto,
  ): Promise<FarmDocument> {
    const existing = await this.prisma.farmDocument.findUnique({
      where: { id: documentId },
      include: { farm: { select: { ownerId: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Document not found');
    }

    const doc = await this.prisma.farmDocument.update({
      where: { id: documentId },
      data: approve
        ? {
            reviewStatus: DocumentReviewStatus.approved,
            reviewNote: dto.note?.trim() || null,
            reviewedAt: new Date(),
            reviewedById: admin.id,
          }
        : {
            reviewStatus: DocumentReviewStatus.rejected,
            reviewNote: dto.note?.trim() || 'Document rejected',
            reviewedAt: new Date(),
            reviewedById: admin.id,
          },
    });

    if (approve && existing.kind === 'idCard') {
      await this.verification.tryCompleteVerification(existing.farm.ownerId);
    }

    return this.toFarmDocument(doc);
  }

  async listPurchaseRequests(status?: string): Promise<AdminPurchaseRequest[]> {
    const requestStatus =
      status &&
      Object.values(PurchaseRequestStatus).includes(status as PurchaseRequestStatus)
        ? (status as PurchaseRequestStatus)
        : undefined;

    const requests = await this.prisma.purchaseRequest.findMany({
      where: requestStatus ? { status: requestStatus } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        buyer: { select: { id: true, email: true, displayName: true } },
        _count: { select: { quotes: true } },
      },
    });

    return requests.map((request) => ({
      id: request.id,
      title: request.title,
      category: request.category,
      quantity: request.quantity,
      unit: request.unit,
      status: request.status,
      moderationNote: request.moderationNote,
      moderatedAt: request.moderatedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      buyer: request.buyer,
      quoteCount: request._count.quotes,
    }));
  }

  async cancelPurchaseRequest(
    admin: AuthenticatedUser,
    id: string,
    dto: ReviewNoteDto,
  ): Promise<AdminPurchaseRequest> {
    const existing = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, email: true, displayName: true } },
        _count: { select: { quotes: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Purchase request not found');
    }

    const request = await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: PurchaseRequestStatus.cancelled,
        moderationNote: dto.note?.trim() || 'Removed by administrator',
        moderatedAt: new Date(),
        moderatedById: admin.id,
      },
      include: {
        buyer: { select: { id: true, email: true, displayName: true } },
        _count: { select: { quotes: true } },
      },
    });

    return {
      id: request.id,
      title: request.title,
      category: request.category,
      quantity: request.quantity,
      unit: request.unit,
      status: request.status,
      moderationNote: request.moderationNote,
      moderatedAt: request.moderatedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      buyer: request.buyer,
      quoteCount: request._count.quotes,
    };
  }

  async listDeals(): Promise<AdminDeal[]> {
    const [rfqs, fulfilledRequests] = await Promise.all([
      this.prisma.rfq.findMany({
        where: {
          status: { in: [RfqStatus.completed, RfqStatus.accepted] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          product: { select: { title: true } },
          buyer: { select: { id: true, email: true, displayName: true } },
          farm: {
            select: {
              name: true,
              owner: { select: { id: true, email: true, displayName: true } },
            },
          },
        },
      }),
      this.prisma.purchaseRequest.findMany({
        where: { status: PurchaseRequestStatus.fulfilled },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          buyer: { select: { id: true, email: true, displayName: true } },
          quotes: {
            where: { status: 'accepted' },
            take: 1,
            include: {
              farm: {
                select: {
                  name: true,
                  owner: { select: { id: true, email: true, displayName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const deals: AdminDeal[] = [
      ...rfqs.map((rfq) => ({
        id: rfq.id,
        kind: 'rfq' as const,
        title: rfq.product.title,
        status: rfq.status,
        completedAt: rfq.completedAt?.toISOString() ?? null,
        createdAt: rfq.createdAt.toISOString(),
        buyer: rfq.buyer,
        seller: {
          id: rfq.farm.owner.id,
          email: rfq.farm.owner.email,
          displayName: rfq.farm.owner.displayName,
          farmName: rfq.farm.name,
        },
      })),
      ...fulfilledRequests.map((request) => {
        const quote = request.quotes[0];
        return {
          id: request.id,
          kind: 'purchase_request' as const,
          title: request.title,
          status: request.status,
          completedAt: request.updatedAt.toISOString(),
          createdAt: request.createdAt.toISOString(),
          buyer: request.buyer,
          seller: quote
            ? {
                id: quote.farm.owner.id,
                email: quote.farm.owner.email,
                displayName: quote.farm.owner.displayName,
                farmName: quote.farm.name,
              }
            : null,
        };
      }),
    ];

    return deals.sort((a, b) => {
      const aTime = a.completedAt ?? a.createdAt;
      const bTime = b.completedAt ?? b.createdAt;
      return bTime.localeCompare(aTime);
    });
  }

  async listCategories(): Promise<CategoryConfigItem[]> {
    const rows = await this.prisma.categoryConfig.findMany();
    return mergeCategoryConfigs(rows);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<CategoryConfigItem[]> {
    if (!(PRODUCT_CATEGORIES as readonly string[]).includes(id)) {
      throw new BadRequestException('Unknown category');
    }

    const existing = await this.prisma.categoryConfig.findUnique({ where: { id } });
    const sortOrder =
      dto.sortOrder ?? existing?.sortOrder ?? PRODUCT_CATEGORIES.indexOf(id as never);

    await this.prisma.categoryConfig.upsert({
      where: { id },
      create: {
        id,
        enabled: dto.enabled ?? true,
        sortOrder,
      },
      update: {
        ...(dto.enabled === undefined ? {} : { enabled: dto.enabled }),
        ...(dto.sortOrder === undefined ? {} : { sortOrder: dto.sortOrder }),
      },
    });

    return this.listCategories();
  }

  async ensureCategoryConfigs(): Promise<void> {
    await Promise.all(
      PRODUCT_CATEGORIES.map((id, index) =>
        this.prisma.categoryConfig.upsert({
          where: { id },
          create: { id, enabled: true, sortOrder: index },
          update: {},
        }),
      ),
    );
  }

  private async requireProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private toFarmDocument(doc: {
    id: string;
    farmId: string;
    title: string;
    fileName: string;
    url: string;
    mimeType: string;
    kind: FarmDocument['kind'];
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

  private toAdminFarm(farm: {
    id: string;
    name: string;
    region: string | null;
    description: string | null;
    verificationStatus: PrismaVerificationStatus;
    verificationNote: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
    owner: {
      id: string;
      email: string;
      displayName: string | null;
      blockedAt: Date | null;
    };
    documents: Array<{
      id: string;
      farmId: string;
      title: string;
      fileName: string;
      url: string;
      mimeType: string;
      kind: FarmDocument['kind'];
      reviewStatus: DocumentReviewStatus;
      reviewNote: string | null;
      reviewedAt: Date | null;
      createdAt: Date;
    }>;
    _count: { products: number };
  }): AdminFarm {
    const documents = farm.documents.map((doc) => this.toFarmDocument(doc));
    return {
      id: farm.id,
      name: farm.name,
      region: farm.region,
      description: farm.description,
      verificationStatus: farm.verificationStatus as VerificationStatus,
      verificationNote: farm.verificationNote,
      verifiedAt: farm.verifiedAt?.toISOString() ?? null,
      createdAt: farm.createdAt.toISOString(),
      owner: {
        id: farm.owner.id,
        email: farm.owner.email,
        displayName: farm.owner.displayName,
        blockedAt: farm.owner.blockedAt?.toISOString() ?? null,
      },
      productCount: farm._count.products,
      pendingDocuments: documents.filter((doc) => doc.reviewStatus === 'pending').length,
      documents,
    };
  }

  private toModerated(product: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    unit: string | null;
    isPublished: boolean;
    moderationStatus: PrismaModerationStatus;
    moderationNote: string | null;
    moderatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    farm: {
      id: string;
      name: string;
      region: string | null;
      owner: {
        id: string;
        displayName: string | null;
        email: string;
        locale: string;
      };
    };
  }): ModeratedProduct {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      category: product.category,
      unit: product.unit,
      isPublished: product.isPublished,
      moderationStatus: product.moderationStatus as ModerationStatus,
      moderationNote: product.moderationNote,
      moderatedAt: product.moderatedAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      farm: {
        id: product.farm.id,
        name: product.farm.name,
        region: product.farm.region,
        owner: {
          id: product.farm.owner.id,
          displayName: product.farm.owner.displayName,
          email: product.farm.owner.email,
        },
      },
    };
  }
}
