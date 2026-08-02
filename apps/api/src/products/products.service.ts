import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProductDetail, ProductSummary } from '@agrobridge/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CatalogQueryDto } from './dto/catalog-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(query: CatalogQueryDto): Promise<ProductSummary[]> {
    const where: Prisma.ProductWhereInput = {
      isPublished: true,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.region) {
      where.farm = {
        region: {
          contains: query.region,
          mode: 'insensitive',
        },
      };
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        farm: {
          select: { id: true, name: true, region: true },
        },
      },
    });

    return products.map((product) => this.toSummary(product));
  }

  async getById(id: string, viewer?: AuthenticatedUser | null): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            region: true,
            ownerId: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isOwner =
      viewer &&
      (viewer.role === 'admin' || product.farm.ownerId === viewer.id);

    if (!product.isPublished && !isOwner) {
      throw new NotFoundException('Product not found');
    }

    return this.toDetail(product);
  }

  async listMine(user: AuthenticatedUser): Promise<ProductSummary[]> {
    this.assertFarmer(user);

    const farm = await this.requireFarm(user.id);
    const products = await this.prisma.product.findMany({
      where: { farmId: farm.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        farm: {
          select: { id: true, name: true, region: true },
        },
      },
    });

    return products.map((product) => this.toSummary(product));
  }

  async create(user: AuthenticatedUser, dto: CreateProductDto): Promise<ProductDetail> {
    this.assertFarmer(user);
    const farm = await this.requireFarm(user.id);

    const product = await this.prisma.product.create({
      data: {
        farmId: farm.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category || null,
        unit: dto.unit || null,
        isPublished: dto.isPublished ?? false,
      },
      include: {
        farm: {
          select: { id: true, name: true, region: true, ownerId: true },
        },
      },
    });

    return this.toDetail(product);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductDetail> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, id);

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined ? undefined : dto.description.trim() || null,
        category: dto.category === undefined ? undefined : dto.category || null,
        unit: dto.unit === undefined ? undefined : dto.unit || null,
        isPublished: dto.isPublished,
      },
      include: {
        farm: {
          select: { id: true, name: true, region: true, ownerId: true },
        },
      },
    });

    return this.toDetail(updated);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<{ ok: true }> {
    this.assertFarmer(user);
    const product = await this.requireOwnedProduct(user.id, id);
    await this.prisma.product.delete({ where: { id: product.id } });
    return { ok: true };
  }

  private async requireFarm(ownerId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { ownerId } });
    if (!farm) {
      throw new NotFoundException('Create a farm profile before adding products');
    }
    return farm;
  }

  private async requireOwnedProduct(ownerId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { farm: true },
    });

    if (!product || product.farm.ownerId !== ownerId) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (user.role !== 'farmer' && user.role !== 'admin') {
      throw new ForbiddenException('Only farmers can manage products');
    }
  }

  private toSummary(product: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    unit: string | null;
    isPublished: boolean;
    farm: { id: string; name: string; region: string | null };
  }): ProductSummary {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      category: product.category,
      unit: product.unit,
      isPublished: product.isPublished,
      farm: product.farm,
    };
  }

  private toDetail(product: {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    unit: string | null;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    farm: { id: string; name: string; region: string | null };
  }): ProductDetail {
    return {
      ...this.toSummary(product),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
