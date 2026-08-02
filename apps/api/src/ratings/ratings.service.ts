import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RatingSummary, RatingView } from '@agrobridge/shared';
import { RfqStatus as PrismaRfqStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateRatingDto): Promise<RatingView> {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: dto.rfqId },
      include: {
        farm: { select: { ownerId: true, owner: { select: { id: true, displayName: true, email: true } } } },
        buyer: { select: { id: true, displayName: true, email: true } },
        ratings: { select: { fromUserId: true } },
      },
    });

    if (!rfq) {
      throw new NotFoundException('Deal not found');
    }
    if (rfq.status !== PrismaRfqStatus.completed) {
      throw new BadRequestException('Ratings are allowed only after the deal is completed');
    }

    const sellerId = rfq.farm.ownerId;
    const isBuyer = rfq.buyerId === user.id;
    const isSeller = sellerId === user.id || user.role === 'admin';

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Only deal participants can leave a rating');
    }

    const toUserId = isBuyer ? sellerId : rfq.buyerId;
    if (toUserId === user.id) {
      throw new BadRequestException('You cannot rate yourself');
    }

    if (rfq.ratings.some((rating) => rating.fromUserId === user.id)) {
      throw new ConflictException('You already rated this deal');
    }

    const rating = await this.prisma.rating.create({
      data: {
        rfqId: rfq.id,
        fromUserId: user.id,
        toUserId,
        score: dto.score,
        comment: dto.comment?.trim() || null,
      },
    });

    return this.toView(rating);
  }

  async summaryForUser(userId: string): Promise<RatingSummary> {
    const aggregate = await this.prisma.rating.aggregate({
      where: { toUserId: userId },
      _avg: { score: true },
      _count: { _all: true },
    });

    const count = aggregate._count._all;
    const average =
      count === 0 || aggregate._avg.score == null
        ? null
        : Math.round(aggregate._avg.score * 10) / 10;

    return { average, count };
  }

  private toView(rating: {
    id: string;
    rfqId: string;
    fromUserId: string;
    toUserId: string;
    score: number;
    comment: string | null;
    createdAt: Date;
  }): RatingView {
    return {
      id: rating.id,
      rfqId: rating.rfqId,
      fromUserId: rating.fromUserId,
      toUserId: rating.toUserId,
      score: rating.score,
      comment: rating.comment,
      createdAt: rating.createdAt.toISOString(),
    };
  }
}
