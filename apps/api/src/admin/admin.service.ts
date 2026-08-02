import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminStats, ModeratedProduct, ModerationStatus } from '@agrobridge/shared';
import { ModerationStatus as PrismaModerationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RejectProductDto } from './dto/reject-product.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<AdminStats> {
    const [productsPending, productsApproved, productsRejected, farmsTotal, usersTotal] =
      await Promise.all([
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
        this.prisma.user.count(),
      ]);

    return {
      productsPending,
      productsApproved,
      productsRejected,
      farmsTotal,
      usersTotal,
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
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            region: true,
            owner: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
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
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            region: true,
            owner: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
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
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            region: true,
            owner: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
      },
    });

    return this.toModerated(product);
  }

  private async requireProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
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
      owner: { id: string; displayName: string | null; email: string };
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
      farm: product.farm,
    };
  }
}
