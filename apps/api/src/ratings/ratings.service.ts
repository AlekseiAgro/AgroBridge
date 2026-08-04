import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  PublicRatingReview,
  PublicRatingReviews,
  RatingSummary,
  RatingView,
} from '@agrobridge/shared';
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
        product: { select: { ownerUserId: true } },
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

    const sellerId = rfq.product.ownerUserId;
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
    const map = await this.summariesForUsers([userId]);
    return map.get(userId) ?? { average: null, count: 0 };
  }

  async listForUser(userId: string): Promise<PublicRatingReviews> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ratings = await this.prisma.rating.findMany({
      where: { toUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        score: true,
        comment: true,
        createdAt: true,
        fromUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    return {
      items: ratings.map((rating) => this.toPublicReview(rating)),
    };
  }

  async summariesForUsers(userIds: string[]): Promise<Map<string, RatingSummary>> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    const result = new Map<string, RatingSummary>();
    for (const id of uniqueIds) {
      result.set(id, { average: null, count: 0 });
    }
    if (uniqueIds.length === 0) {
      return result;
    }

    const groups = await this.prisma.rating.groupBy({
      by: ['toUserId'],
      where: { toUserId: { in: uniqueIds } },
      _avg: { score: true },
      _count: { _all: true },
    });

    for (const group of groups) {
      const count = group._count._all;
      const average =
        count === 0 || group._avg.score == null
          ? null
          : Math.round(group._avg.score * 10) / 10;
      result.set(group.toUserId, { average, count });
    }

    return result;
  }

  private toPublicReview(rating: {
    id: string;
    score: number;
    comment: string | null;
    createdAt: Date;
    fromUser: { id: string; displayName: string | null };
  }): PublicRatingReview {
    return {
      id: rating.id,
      score: rating.score,
      comment: rating.comment,
      createdAt: rating.createdAt.toISOString(),
      fromUser: {
        id: rating.fromUser.id,
        displayName: rating.fromUser.displayName,
      },
    };
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
