import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canTrade, type RfqOfferView, type RfqSummary, type RfqStatus } from '@agrobridge/shared';
import { CurrencyCode, Prisma, RfqStatus as PrismaRfqStatus } from '@prisma/client';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';

const sellerSelect = {
  id: true,
  email: true,
  locale: true,
  displayName: true,
} as const;

const rfqInclude = {
  product: {
    select: {
      id: true,
      title: true,
      ownerUserId: true,
      owner: { select: sellerSelect },
    },
  },
  farm: {
    select: {
      id: true,
      name: true,
      region: true,
      ownerId: true,
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
  ratings: {
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      score: true,
      comment: true,
      createdAt: true,
    },
  },
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
        owner: { select: sellerSelect },
        farm: { select: { id: true, name: true } },
      },
    });

    if (
      !product ||
      !product.isPublished ||
      product.moderationStatus !== 'approved'
    ) {
      throw new NotFoundException('Product not found');
    }

    if (product.ownerUserId === user.id) {
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
      farmer: product.owner,
      buyerName: user.displayName?.trim() || user.email,
      productTitle: product.title,
      quantity: rfq.quantity,
      unit: rfq.unit,
      rfqId: rfq.id,
    });

    return this.toSummary(rfq, user);
  }

  async listMine(user: AuthenticatedUser): Promise<RfqSummary[]> {
    this.assertBuyer(user);

    const items = await this.prisma.rfq.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: rfqInclude,
    });

    return items.map((item) => this.toSummary(item, user));
  }

  async listInbox(user: AuthenticatedUser): Promise<RfqSummary[]> {
    this.assertFarmer(user);

    const items = await this.prisma.rfq.findMany({
      where: { product: { ownerUserId: user.id } },
      orderBy: { createdAt: 'desc' },
      include: rfqInclude,
    });

    return items.map((item) => this.toSummary(item, user));
  }

  async getById(user: AuthenticatedUser, id: string): Promise<RfqSummary> {
    const rfq = await this.requireAccessibleRfq(user, id);
    return this.toSummary(rfq, user);
  }

  async createOffer(
    user: AuthenticatedUser,
    id: string,
    dto: CreateOfferDto,
  ): Promise<RfqSummary> {
    this.assertFarmer(user);
    const rfq = await this.requireSellerOwnedRfq(user, id);

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
      farmName: this.sellerLabel(rfq),
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
      farmer: rfq.product.owner,
      buyerName: rfq.buyer.displayName?.trim() || rfq.buyer.email,
      productTitle: rfq.product.title,
      rfqId: rfq.id,
    });

    return this.getById(user, id);
  }

  async decline(user: AuthenticatedUser, id: string): Promise<RfqSummary> {
    const rfq = await this.requireAccessibleRfq(user, id);

    const isBuyer = rfq.buyerId === user.id;
    const isSellerOwner = this.isSeller(rfq, user);

    if (isBuyer) {
      if (rfq.status !== PrismaRfqStatus.offered) {
        throw new BadRequestException('Buyers can decline only after an offer is received');
      }
    } else if (isSellerOwner) {
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
        farmer: rfq.product.owner,
        buyerName: rfq.buyer.displayName?.trim() || rfq.buyer.email,
        productTitle: rfq.product.title,
        rfqId: rfq.id,
      });
    } else {
      await this.notifications.notifyRfqDeclinedByFarmer({
        buyer: rfq.buyer,
        farmName: this.sellerLabel(rfq),
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
      farmer: rfq.product.owner,
      buyerName: rfq.buyer.displayName?.trim() || rfq.buyer.email,
      productTitle: rfq.product.title,
    });

    return this.getById(user, id);
  }

  async complete(user: AuthenticatedUser, id: string): Promise<RfqSummary> {
    const rfq = await this.requireAccessibleRfq(user, id);
    const isBuyer = rfq.buyerId === user.id;
    const isSeller = this.isSeller(rfq, user);

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Not allowed');
    }
    if (rfq.status !== PrismaRfqStatus.accepted) {
      throw new BadRequestException('Only accepted deals can be marked completed');
    }

    await this.prisma.rfq.update({
      where: { id: rfq.id },
      data: {
        status: PrismaRfqStatus.completed,
        completedAt: new Date(),
      },
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
    const isSellerOwner = rfq.product.ownerUserId === user.id;
    if (!isBuyer && !isSellerOwner && user.role !== 'admin') {
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

  private async requireSellerOwnedRfq(user: AuthenticatedUser, id: string): Promise<RfqEntity> {
    const rfq = await this.requireAccessibleRfq(user, id);
    if (rfq.product.ownerUserId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Not allowed');
    }
    return rfq;
  }

  private assertBuyer(user: AuthenticatedUser) {
    if (!canTrade(user.role)) {
      throw new ForbiddenException('Sign in to perform this action');
    }
  }

  private assertFarmer(user: AuthenticatedUser) {
    if (!canTrade(user.role)) {
      throw new ForbiddenException('Sign in to perform this action');
    }
  }

  private isSeller(rfq: RfqEntity, user: AuthenticatedUser): boolean {
    return rfq.product.ownerUserId === user.id || user.role === 'admin';
  }

  private sellerLabel(rfq: RfqEntity): string {
    return (
      rfq.farm?.name ||
      rfq.product.owner.displayName?.trim() ||
      rfq.product.owner.email
    );
  }

  private toSummary(rfq: RfqEntity, viewer: AuthenticatedUser): RfqSummary {
    const seller = {
      id: rfq.product.owner.id,
      displayName: rfq.product.owner.displayName,
      email: rfq.product.owner.email,
    };
    const isParticipant =
      rfq.buyerId === viewer.id ||
      rfq.product.ownerUserId === viewer.id ||
      viewer.role === 'admin';
    const myRating = rfq.ratings.find((rating) => rating.fromUserId === viewer.id) ?? null;
    const counterpartyRating =
      rfq.ratings.find((rating) => rating.fromUserId !== viewer.id) ?? null;

    return {
      id: rfq.id,
      status: rfq.status as RfqStatus,
      quantity: rfq.quantity,
      unit: rfq.unit,
      message: rfq.message,
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
      completedAt: rfq.completedAt?.toISOString() ?? null,
      product: {
        id: rfq.product.id,
        title: rfq.product.title,
      },
      farm: rfq.farm
        ? {
            id: rfq.farm.id,
            name: rfq.farm.name,
            region: rfq.farm.region,
            ownerId: rfq.farm.ownerId,
          }
        : null,
      buyer: {
        id: rfq.buyer.id,
        displayName: rfq.buyer.displayName,
        email: rfq.buyer.email,
      },
      seller,
      offer: rfq.offer ? this.toOffer(rfq.offer) : null,
      canComplete: isParticipant && rfq.status === PrismaRfqStatus.accepted,
      canRate: isParticipant && rfq.status === PrismaRfqStatus.completed && myRating == null,
      myRating: myRating
        ? {
            score: myRating.score,
            comment: myRating.comment,
            createdAt: myRating.createdAt.toISOString(),
          }
        : null,
      counterpartyRating: counterpartyRating
        ? {
            score: counterpartyRating.score,
            comment: counterpartyRating.comment,
            createdAt: counterpartyRating.createdAt.toISOString(),
          }
        : null,
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
