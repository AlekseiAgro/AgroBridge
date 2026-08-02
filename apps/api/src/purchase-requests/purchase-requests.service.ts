import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  PurchaseQuoteView,
  PurchaseRequestDetail,
  PurchaseRequestSummary,
} from '@agrobridge/shared';
import {
  CurrencyCode,
  Prisma,
  PurchaseQuoteStatus,
  PurchaseRequestStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseQuoteDto } from './dto/create-purchase-quote.dto';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';

const quoteInclude = {
  farm: {
    select: {
      id: true,
      name: true,
      region: true,
      ownerId: true,
    },
  },
} satisfies Prisma.PurchaseQuoteInclude;

const requestInclude = {
  buyer: {
    select: {
      id: true,
      displayName: true,
    },
  },
  quotes: {
    include: quoteInclude,
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.PurchaseRequestInclude;

type RequestEntity = Prisma.PurchaseRequestGetPayload<{ include: typeof requestInclude }>;
type QuoteEntity = Prisma.PurchaseQuoteGetPayload<{ include: typeof quoteInclude }>;

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOpen(
    filters: {
      category?: string;
      q?: string;
    },
    viewer: AuthenticatedUser | null = null,
  ): Promise<PurchaseRequestSummary[]> {
    const items = await this.prisma.purchaseRequest.findMany({
      where: {
        status: PurchaseRequestStatus.open,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { variety: { contains: filters.q, mode: 'insensitive' } },
                { packaging: { contains: filters.q, mode: 'insensitive' } },
                { destinationCountry: { contains: filters.q, mode: 'insensitive' } },
                { message: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    });

    return items.map((item) => this.toSummary(item, viewer));
  }

  async listMine(user: AuthenticatedUser): Promise<PurchaseRequestSummary[]> {
    this.assertBuyer(user);

    const items = await this.prisma.purchaseRequest.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    });

    return items.map((item) => this.toSummary(item, user));
  }

  async create(
    user: AuthenticatedUser,
    dto: CreatePurchaseRequestDto,
  ): Promise<PurchaseRequestDetail> {
    this.assertBuyer(user);

    const created = await this.prisma.purchaseRequest.create({
      data: {
        buyerId: user.id,
        title: dto.title.trim(),
        category: dto.category,
        quantity: dto.quantity.trim(),
        unit: dto.unit || null,
        variety: dto.variety?.trim() || null,
        packaging: dto.packaging?.trim() || null,
        destinationCountry: dto.destinationCountry?.trim() || null,
        message: dto.message?.trim() || null,
        status: PurchaseRequestStatus.open,
      },
      include: requestInclude,
    });

    return this.toDetail(created, user);
  }

  async getById(user: AuthenticatedUser | null, id: string): Promise<PurchaseRequestDetail> {
    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: requestInclude,
    });

    if (!request) {
      throw new NotFoundException('Purchase request not found');
    }

    const isOwner = Boolean(user && request.buyerId === user.id);
    const isAdmin = user?.role === 'admin';
    if (request.status !== PurchaseRequestStatus.open && !isOwner && !isAdmin) {
      throw new ForbiddenException('This purchase request is no longer public');
    }

    return this.toDetail(request, user);
  }

  async cancel(user: AuthenticatedUser, id: string): Promise<PurchaseRequestDetail> {
    this.assertBuyer(user);
    const request = await this.requireOwnedOpen(user, id);

    const updated = await this.prisma.purchaseRequest.update({
      where: { id: request.id },
      data: { status: PurchaseRequestStatus.cancelled },
      include: requestInclude,
    });

    return this.toDetail(updated, user);
  }

  async close(user: AuthenticatedUser, id: string): Promise<PurchaseRequestDetail> {
    this.assertBuyer(user);
    const request = await this.requireOwnedOpen(user, id);

    const updated = await this.prisma.purchaseRequest.update({
      where: { id: request.id },
      data: { status: PurchaseRequestStatus.closed },
      include: requestInclude,
    });

    return this.toDetail(updated, user);
  }

  async createQuote(
    user: AuthenticatedUser,
    id: string,
    dto: CreatePurchaseQuoteDto,
  ): Promise<PurchaseRequestDetail> {
    this.assertFarmer(user);

    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      throw new BadRequestException('Create a farm profile before sending quotes');
    }

    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!request) {
      throw new NotFoundException('Purchase request not found');
    }
    if (request.status !== PurchaseRequestStatus.open) {
      throw new BadRequestException('This purchase request is no longer open');
    }
    if (request.buyerId === user.id) {
      throw new BadRequestException('You cannot quote on your own purchase request');
    }

    const existing = request.quotes.find((quote) => quote.farmId === farm.id);
    if (existing && existing.status !== PurchaseQuoteStatus.withdrawn) {
      throw new BadRequestException('You already sent a quote for this request');
    }

    if (existing) {
      await this.prisma.purchaseQuote.update({
        where: { id: existing.id },
        data: {
          priceAmount: new Prisma.Decimal(dto.priceAmount),
          currency: dto.currency as CurrencyCode,
          quantity: dto.quantity?.trim() || null,
          unit: dto.unit || null,
          message: dto.message?.trim() || null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          status: PurchaseQuoteStatus.pending,
        },
      });
    } else {
      await this.prisma.purchaseQuote.create({
        data: {
          requestId: request.id,
          farmId: farm.id,
          priceAmount: new Prisma.Decimal(dto.priceAmount),
          currency: dto.currency as CurrencyCode,
          quantity: dto.quantity?.trim() || null,
          unit: dto.unit || null,
          message: dto.message?.trim() || null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          status: PurchaseQuoteStatus.pending,
        },
      });
    }

    return this.getById(user, id);
  }

  async acceptQuote(
    user: AuthenticatedUser,
    requestId: string,
    quoteId: string,
  ): Promise<PurchaseRequestDetail> {
    this.assertBuyer(user);
    const request = await this.requireOwnedOpen(user, requestId);
    const quote = request.quotes.find((item) => item.id === quoteId);
    if (!quote || quote.status !== PurchaseQuoteStatus.pending) {
      throw new BadRequestException('Quote is not available to accept');
    }

    await this.prisma.$transaction([
      this.prisma.purchaseQuote.update({
        where: { id: quote.id },
        data: { status: PurchaseQuoteStatus.accepted },
      }),
      this.prisma.purchaseQuote.updateMany({
        where: {
          requestId: request.id,
          id: { not: quote.id },
          status: PurchaseQuoteStatus.pending,
        },
        data: { status: PurchaseQuoteStatus.declined },
      }),
      this.prisma.purchaseRequest.update({
        where: { id: request.id },
        data: { status: PurchaseRequestStatus.fulfilled },
      }),
    ]);

    return this.getById(user, requestId);
  }

  async declineQuote(
    user: AuthenticatedUser,
    requestId: string,
    quoteId: string,
  ): Promise<PurchaseRequestDetail> {
    this.assertBuyer(user);
    const request = await this.requireOwnedOpen(user, requestId);
    const quote = request.quotes.find((item) => item.id === quoteId);
    if (!quote || quote.status !== PurchaseQuoteStatus.pending) {
      throw new BadRequestException('Quote is not available to decline');
    }

    await this.prisma.purchaseQuote.update({
      where: { id: quote.id },
      data: { status: PurchaseQuoteStatus.declined },
    });

    return this.getById(user, requestId);
  }

  async withdrawQuote(
    user: AuthenticatedUser,
    requestId: string,
    quoteId: string,
  ): Promise<PurchaseRequestDetail> {
    this.assertFarmer(user);
    const farm = await this.prisma.farm.findUnique({ where: { ownerId: user.id } });
    if (!farm) {
      throw new ForbiddenException('Farm profile required');
    }

    const quote = await this.prisma.purchaseQuote.findUnique({
      where: { id: quoteId },
      include: { request: true },
    });
    if (!quote || quote.requestId !== requestId) {
      throw new NotFoundException('Quote not found');
    }
    if (quote.farmId !== farm.id && user.role !== 'admin') {
      throw new ForbiddenException('Not allowed to withdraw this quote');
    }
    if (quote.request.status !== PurchaseRequestStatus.open) {
      throw new BadRequestException('This purchase request is no longer open');
    }
    if (quote.status !== PurchaseQuoteStatus.pending) {
      throw new BadRequestException('Only pending quotes can be withdrawn');
    }

    await this.prisma.purchaseQuote.update({
      where: { id: quote.id },
      data: { status: PurchaseQuoteStatus.withdrawn },
    });

    return this.getById(user, requestId);
  }

  private async requireOwnedOpen(user: AuthenticatedUser, id: string): Promise<RequestEntity> {
    const request = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!request) {
      throw new NotFoundException('Purchase request not found');
    }
    if (request.buyerId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Not allowed to manage this purchase request');
    }
    if (request.status !== PurchaseRequestStatus.open) {
      throw new BadRequestException('Purchase request is not open');
    }
    return request;
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

  private toQuoteView(
    quote: QuoteEntity,
    viewer: AuthenticatedUser | null,
    request: RequestEntity,
  ): PurchaseQuoteView {
    const isOwner = Boolean(viewer && request.buyerId === viewer.id);
    const isAuthor = Boolean(viewer && quote.farm.ownerId === viewer.id);
    const isAdmin = viewer?.role === 'admin';
    const pending = quote.status === PurchaseQuoteStatus.pending;
    const requestOpen = request.status === PurchaseRequestStatus.open;

    return {
      id: quote.id,
      status: quote.status,
      priceAmount: quote.priceAmount.toFixed(2),
      currency: quote.currency,
      quantity: quote.quantity,
      unit: quote.unit,
      message: quote.message,
      validUntil: quote.validUntil?.toISOString() ?? null,
      createdAt: quote.createdAt.toISOString(),
      farm: {
        id: quote.farm.id,
        name: quote.farm.name,
        region: quote.farm.region,
        ownerId: quote.farm.ownerId,
      },
      canAccept: Boolean((isOwner || isAdmin) && pending && requestOpen),
      canDecline: Boolean((isOwner || isAdmin) && pending && requestOpen),
      canWithdraw: Boolean((isAuthor || isAdmin) && pending && requestOpen),
    };
  }

  private toSummary(
    request: RequestEntity,
    viewer: AuthenticatedUser | null,
    farmId?: string | null,
  ): PurchaseRequestSummary {
    const myQuoteEntity = farmId
      ? request.quotes.find((quote) => quote.farmId === farmId) ?? null
      : viewer
        ? request.quotes.find((quote) => quote.farm.ownerId === viewer.id) ?? null
        : null;

    const publicQuoteCount = request.quotes.filter(
      (quote) => quote.status !== PurchaseQuoteStatus.withdrawn,
    ).length;

    return {
      id: request.id,
      title: request.title,
      category: request.category,
      quantity: request.quantity,
      unit: request.unit,
      variety: request.variety,
      packaging: request.packaging,
      destinationCountry: request.destinationCountry,
      message: request.message,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      buyer: {
        id: request.buyer.id,
        displayName: request.buyer.displayName,
      },
      quoteCount: publicQuoteCount,
      myQuote: myQuoteEntity ? this.toQuoteView(myQuoteEntity, viewer, request) : null,
    };
  }

  private toDetail(
    request: RequestEntity,
    viewer: AuthenticatedUser | null,
  ): PurchaseRequestDetail {
    const isOwner = Boolean(viewer && request.buyerId === viewer.id);
    const isAdmin = viewer?.role === 'admin';
    const isFarmer = Boolean(viewer && (viewer.role === 'farmer' || viewer.role === 'admin'));
    const requestOpen = request.status === PurchaseRequestStatus.open;
    const hasActiveQuote = Boolean(
      viewer &&
        request.quotes.some(
          (quote) =>
            quote.farm.ownerId === viewer.id && quote.status !== PurchaseQuoteStatus.withdrawn,
        ),
    );

    const summary = this.toSummary(request, viewer);
    const quotes = this.visibleQuotes(request, viewer).map((quote) =>
      this.toQuoteView(quote, viewer, request),
    );

    return {
      ...summary,
      quotes,
      canCancel: Boolean((isOwner || isAdmin) && requestOpen),
      canClose: Boolean((isOwner || isAdmin) && requestOpen),
      canQuote: Boolean(
        isFarmer &&
          requestOpen &&
          viewer &&
          request.buyerId !== viewer.id &&
          !hasActiveQuote,
      ),
      canMessageBuyer: Boolean(
        isFarmer && viewer && request.buyerId !== viewer.id && requestOpen,
      ),
    };
  }

  private visibleQuotes(request: RequestEntity, viewer: AuthenticatedUser | null): QuoteEntity[] {
    const isOwner = Boolean(viewer && request.buyerId === viewer.id);
    const isAdmin = viewer?.role === 'admin';
    if (isOwner || isAdmin) {
      return request.quotes.filter((quote) => quote.status !== PurchaseQuoteStatus.withdrawn);
    }
    if (viewer) {
      return request.quotes.filter((quote) => quote.farm.ownerId === viewer.id);
    }
    return [];
  }
}
