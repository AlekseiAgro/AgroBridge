import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RfqOfferView, RfqSummary, RfqStatus } from '@agrobridge/shared';
import { CurrencyCode, Prisma, RfqStatus as PrismaRfqStatus } from '@prisma/client';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';

const rfqInclude = {
  product: { select: { id: true, title: true } },
  farm: {
    select: {
      id: true,
      name: true,
      region: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          email: true,
          locale: true,
          displayName: true,
        },
      },
    },
  },
  buyer: {
    select: {
      id: true,
      displayName: true,
      email: true,
      locale: true,
    },
  },
  offer: true,
} satisfies Prisma.RfqInclude;

type RfqEntity = Prisma.RfqGetPayload<{ include: typeof rfqInclude }>;

@Injectable()
export class RfqsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateRfqDto): Promise<RfqSummary> {
    this.assertBuyer(user);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        farm: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                locale: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!product || !product.isPublished) {
      throw new NotFoundException('Product not found');
    }

    if (product.farm.ownerId === user.id) {
      throw new BadRequestException('You cannot request a quote for your own product');
    }

    const rfq = await this.prisma.rfq.create({
      data: {
        productId: product.id,
        farmId: product.farmId,
        buyerId: user.id,
        quantity: dto.quantity.trim(),
        unit: dto.unit || product.unit || null,
        message: dto.message?.trim() || null,
        status: PrismaRfqStatus.pending,
      },
      include: rfqInclude,
    });

    await this.notifications.notifyRfqCreated({
      farmer: product.farm.owner,
      buyerName: user.displayName?.trim() || user.email,
      productTitle: product.title,
      quantity: rfq.quantity,
      unit: rfq.unit,
      rfqId: rfq.id,
    });

    return this.toSummary(rfq);
  }

  async listMine(user: AuthenticatedUser): Promise<RfqSummary[]> {
    this.assertBuyer(user);

    const items = await this.prisma.rfq.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: rfqInclude,
    });

    return items.map((item) => this.toSummary(item));
  }

  async listInbox(user: AuthenticatedUser): Promise<RfqSummary[]> {
    this.assertFarmer(user);

    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      return [];
    }

    const items = await this.prisma.rfq.findMany({
      where: { farmId: farm.id },
      orderBy: { createdAt: 'desc' },
      include: rfqInclude,
    });

    return items.map((item) => this.toSummary(item));
  }

  async getById(user: AuthenticatedUser, id: string): Promise<RfqSummary> {
    const rfq = await this.requireAccessibleRfq(user, id);
    return this.toSummary(rfq);
  }

  async createOffer(
    user: AuthenticatedUser,
    id: string,
    dto: CreateOfferDto,
  ): Promise<RfqSummary> {
    this.assertFarmer(user);
    const rfq = await this.requireFarmOwnedRfq(user, id);

    if (rfq.status !== PrismaRfqStatus.pending && rfq.status !== PrismaRfqStatus.offered) {
      throw new BadRequestException('Offers can only be sent for pending or offered requests');
    }

    if (rfq.offer) {
      throw new BadRequestException('An offer already exists for this request');
    }

    const price = new Prisma.Decimal(dto.priceAmount);
    if (price.lte(0)) {
      throw new BadRequestException('priceAmount must be greater than zero');
    }

    const offer = await this.prisma.rfqOffer.create({
      data: {
        rfqId: rfq.id,
        priceAmount: price,
        currency: dto.currency as CurrencyCode,
        quantity: dto.quantity?.trim() || rfq.quantity,
        unit: dto.unit || rfq.unit,
        message: dto.message?.trim() || null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
    });

    await this.prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: PrismaRfqStatus.offered },
    });

    await this.notifications.notifyRfqOfferCreated({
      buyer: rfq.buyer,
      farmName: rfq.farm.name,
      productTitle: rfq.product.title,
      priceAmount: offer.priceAmount.toString(),
      currency: offer.currency,
      rfqId: rfq.id,
    });

    return this.getById(user, id);
  }

  async accept(user: AuthenticatedUser, id: string): Promise<RfqSummary> {
    this.assertBuyer(user);
    const rfq = await this.requireBuyerOwnedRfq(user, id);

    if (rfq.status !== PrismaRfqStatus.offered || !rfq.offer) {
      throw new BadRequestException('Only offered requests can be accepted');
    }

    await this.prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: PrismaRfqStatus.accepted },
    });

    await this.notifications.notifyRfqAccepted({
      farmer: rfq.farm.owner,
      buyerName: rfq.buyer.displayName?.trim() || rfq.buyer.email,
      productTitle: rfq.product.title,
      rfqId: rfq.id,
    });

    return this.getById(user, id);
  }

  async decline(user: AuthenticatedUser, id: string): Promise<RfqSummary> {
    const rfq = await this.requireAccessibleRfq(user, id);

    const isBuyer = rfq.buyerId === user.id;
    const isFarmerOwner = rfq.farm.ownerId === user.id || user.role === 'admin';

    if (isBuyer) {
      if (rfq.status !== PrismaRfqStatus.offered) {
        throw new BadRequestException('Buyers can decline only after an offer is received');
      }
    } else if (isFarmerOwner) {
      if (rfq.status !== PrismaRfqStatus.pending && rfq.status !== PrismaRfqStatus.offered) {
        throw new BadRequestException('This request can no longer be declined');
      }
    } else {
      throw new ForbiddenException('Not allowed');
    }

    await this.prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: PrismaRfqStatus.declined },
    });

    if (isBuyer) {
      await this.notifications.notifyRfqDeclinedByBuyer({
        farmer: rfq.farm.owner,
        buyerName: rfq.buyer.displayName?.trim() || rfq.buyer.email,
        productTitle: rfq.product.title,
        rfqId: rfq.id,
      });
    } else {
      await this.notifications.notifyRfqDeclinedByFarmer({
        buyer: rfq.buyer,
        farmName: rfq.farm.name,
        productTitle: rfq.product.title,
        rfqId: rfq.id,
      });
    }

    return this.getById(user, id);
  }

  async cancel(user: AuthenticatedUser, id: string): Promise<RfqSummary> {
    this.assertBuyer(user);
    const rfq = await this.requireBuyerOwnedRfq(user, id);

    if (rfq.status !== PrismaRfqStatus.pending) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    await this.prisma.rfq.update({
      where: { id: rfq.id },
      data: { status: PrismaRfqStatus.cancelled },
    });

    await this.notifications.notifyRfqCancelled({
      farmer: rfq.farm.owner,
      buyerName: rfq.buyer.displayName?.trim() || rfq.buyer.email,
      productTitle: rfq.product.title,
    });

    return this.getById(user, id);
  }

  private async requireAccessibleRfq(user: AuthenticatedUser, id: string): Promise<RfqEntity> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id },
      include: rfqInclude,
    });

    if (!rfq) {
      throw new NotFoundException('Request not found');
    }

    const isBuyer = rfq.buyerId === user.id;
    const isFarmerOwner = rfq.farm.ownerId === user.id;
    if (!isBuyer && !isFarmerOwner && user.role !== 'admin') {
      throw new ForbiddenException('Not allowed to view this request');
    }

    return rfq;
  }

  private async requireBuyerOwnedRfq(user: AuthenticatedUser, id: string): Promise<RfqEntity> {
    const rfq = await this.requireAccessibleRfq(user, id);
    if (rfq.buyerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Not allowed');
    }
    return rfq;
  }

  private async requireFarmOwnedRfq(user: AuthenticatedUser, id: string): Promise<RfqEntity> {
    const rfq = await this.requireAccessibleRfq(user, id);
    if (rfq.farm.ownerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Not allowed');
    }
    return rfq;
  }

  private assertBuyer(user: AuthenticatedUser) {
    if (user.role !== 'buyer' && user.role !== 'admin') {
      throw new ForbiddenException('Only buyers can perform this action');
    }
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (user.role !== 'farmer' && user.role !== 'admin') {
      throw new ForbiddenException('Only farmers can perform this action');
    }
  }

  private toSummary(rfq: RfqEntity): RfqSummary {
    return {
      id: rfq.id,
      status: rfq.status as RfqStatus,
      quantity: rfq.quantity,
      unit: rfq.unit,
      message: rfq.message,
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
      product: rfq.product,
      farm: {
        id: rfq.farm.id,
        name: rfq.farm.name,
        region: rfq.farm.region,
      },
      buyer: {
        id: rfq.buyer.id,
        displayName: rfq.buyer.displayName,
        email: rfq.buyer.email,
      },
      offer: rfq.offer ? this.toOffer(rfq.offer) : null,
    };
  }

  private toOffer(offer: NonNullable<RfqEntity['offer']>): RfqOfferView {
    return {
      id: offer.id,
      priceAmount: offer.priceAmount.toString(),
      currency: offer.currency,
      quantity: offer.quantity,
      unit: offer.unit,
      message: offer.message,
      validUntil: offer.validUntil?.toISOString() ?? null,
      createdAt: offer.createdAt.toISOString(),
    };
  }
}
