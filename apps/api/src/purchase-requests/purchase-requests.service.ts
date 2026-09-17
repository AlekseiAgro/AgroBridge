import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  canTrade,
  type PurchaseQuoteView,
  type PurchaseRequestDetail,
  type PurchaseRequestSummary,
} from '@agrobridge/shared';
import {
  CurrencyCode,
  Prisma,
  PurchaseQuoteStatus,
  PurchaseRequestStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from '../mail/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreatePurchaseQuoteDto } from './dto/create-purchase-quote.dto';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';

/**
 * The owner's contact details are loaded for the notification emails only. Every response
 * shape is built by hand in `toQuoteView` / `toSummary`, so nothing here reaches an API
 * consumer.
 */
const quoteInclude = {
  farm: {
    select: {
      id: true,
      name: true,
      region: true,
      ownerId: true,
      owner: {
        select: {
          email: true,
          locale: true,
          displayName: true,
        },
      },
    },
  },
} satisfies Prisma.PurchaseQuoteInclude;

const requestInclude = {
  buyer: {
    select: {
      id: true,
      displayName: true,
      email: true,
      locale: true,
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
  private readonly logger = new Logger(PurchaseRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
  ) {}

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

    await this.subscriptions.notifyNewPurchaseRequest({
      requestId: created.id,
      title: created.title,
      category: created.category,
      quantity: created.quantity,
      unit: created.unit,
      buyerUserId: user.id,
      buyerName: user.displayName?.trim() || user.email,
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
    return this.withdraw(user, id, 'cancelled');
  }

  async close(user: AuthenticatedUser, id: string): Promise<PurchaseRequestDetail> {
    return this.withdraw(user, id, 'closed');
  }

  private async withdraw(
    user: AuthenticatedUser,
    id: string,
    reason: 'closed' | 'cancelled',
  ): Promise<PurchaseRequestDetail> {
    this.assertBuyer(user);
    const request = await this.requireOwnedOpen(user, id);

    // Same lock order as acceptQuote: the purchase-request row first, then the quotes.
    // Concurrent close/cancel/accept then serialize on one row instead of deadlocking.
    const pending = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.purchaseRequest.updateMany({
        where: { id: request.id, status: PurchaseRequestStatus.open },
        data: {
          status:
            reason === 'closed' ? PurchaseRequestStatus.closed : PurchaseRequestStatus.cancelled,
        },
      });
      if (closed.count !== 1) {
        throw new ConflictException('Purchase request is no longer open');
      }

      const stillPending = await tx.purchaseQuote.findMany({
        where: { requestId: request.id, status: PurchaseQuoteStatus.pending },
        include: quoteInclude,
      });
      await tx.purchaseQuote.updateMany({
        where: { requestId: request.id, status: PurchaseQuoteStatus.pending },
        data: { status: PurchaseQuoteStatus.declined },
      });
      return stillPending;
    });

    await this.announce(`purchase request ${request.id} ${reason}`, async () => {
      const buyerName = this.buyerLabel(request);
      await Promise.all(
        pending.map((quote) =>
          this.notifications.notifyPurchaseRequestWithdrawn({
            farmer: quote.farm.owner,
            buyerName,
            title: request.title,
            reason,
          }),
        ),
      );
    });

    return this.getById(user, id);
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

    const quoteData = {
      priceAmount: new Prisma.Decimal(dto.priceAmount),
      currency: dto.currency as CurrencyCode,
      quantity: dto.quantity?.trim() || null,
      unit: dto.unit || null,
      message: dto.message?.trim() || null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      status: PurchaseQuoteStatus.pending,
    };

    // Same lock order as withdraw/acceptQuote: the purchase-request row first, then the
    // quote write. A no-op OPEN→OPEN update is the lock — it serializes us with close,
    // cancel and accept so a PENDING quote cannot land after those have already committed.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseRequest.updateMany({
        where: { id: request.id, status: PurchaseRequestStatus.open },
        data: { status: PurchaseRequestStatus.open },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Purchase request is no longer open');
      }

      if (existing) {
        await tx.purchaseQuote.update({
          where: { id: existing.id },
          data: quoteData,
        });
      } else {
        await tx.purchaseQuote.create({
          data: {
            requestId: request.id,
            farmId: farm.id,
            ...quoteData,
          },
        });
      }
    });

    await this.announce(`quote from farm ${farm.id} on request ${request.id}`, () =>
      this.notifications.notifyPurchaseQuoteReceived({
        buyer: request.buyer,
        farmName: farm.name,
        title: request.title,
        priceAmount: new Prisma.Decimal(dto.priceAmount).toFixed(2),
        currency: dto.currency,
        requestId: request.id,
      }),
    );

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

    // One purchase request awards at most one quote. The reads above cannot enforce that:
    // two buyers' tabs (or two retries) can both find a pending quote and both proceed.
    const losers = await this.prisma.$transaction(async (tx) => {
      // The purchase request row is the lock, and it is taken first. Claiming the quote
      // first would let concurrent attempts hold each other's quote rows while both wait
      // for this one, which Postgres resolves as a deadlock rather than as a loser.
      const claimed = await tx.purchaseRequest.updateMany({
        where: { id: request.id, status: PurchaseRequestStatus.open },
        data: { status: PurchaseRequestStatus.fulfilled },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('This purchase request has already been decided');
      }

      const awarded = await tx.purchaseQuote.updateMany({
        where: {
          id: quote.id,
          requestId: request.id,
          status: PurchaseQuoteStatus.pending,
        },
        data: { status: PurchaseQuoteStatus.accepted },
      });
      if (awarded.count !== 1) {
        // Withdrawn between the read and the claim. Rolling back beats fulfilling a
        // request that has no winner.
        throw new ConflictException('Quote is not available to accept');
      }

      const stillPending = await tx.purchaseQuote.findMany({
        where: {
          requestId: request.id,
          id: { not: quote.id },
          status: PurchaseQuoteStatus.pending,
        },
        include: quoteInclude,
      });
      await tx.purchaseQuote.updateMany({
        where: {
          requestId: request.id,
          id: { not: quote.id },
          status: PurchaseQuoteStatus.pending,
        },
        data: { status: PurchaseQuoteStatus.declined },
      });
      return stillPending;
    });

    await this.announce(`acceptance of quote ${quote.id}`, async () => {
      const buyerName = this.buyerLabel(request);
      await this.notifications.notifyPurchaseQuoteAccepted({
        farmer: quote.farm.owner,
        buyerName,
        title: request.title,
      });
      await Promise.all(
        losers.map((loser) =>
          this.notifications.notifyPurchaseQuoteDeclined({
            farmer: loser.farm.owner,
            buyerName,
            title: request.title,
          }),
        ),
      );
    });

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

    const declined = await this.prisma.purchaseQuote.updateMany({
      where: { id: quote.id, requestId: request.id, status: PurchaseQuoteStatus.pending },
      data: { status: PurchaseQuoteStatus.declined },
    });
    if (declined.count !== 1) {
      throw new ConflictException('Quote is not available to decline');
    }

    await this.announce(`decline of quote ${quote.id}`, () =>
      this.notifications.notifyPurchaseQuoteDeclined({
        farmer: quote.farm.owner,
        buyerName: this.buyerLabel(request),
        title: request.title,
      }),
    );

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

  /**
   * Mail is best-effort and runs after the state change has committed: a supplier whose
   * mailbox bounces must not undo an accepted deal. Every caller sits behind a conditional
   * update, so an operation that changed nothing reaches this point never, and nobody is
   * told twice about the same transition.
   */
  private async announce(what: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.error(
        `Failed to send notifications for ${what}`,
        error instanceof Error ? error.name : 'unknown error',
      );
    }
  }

  private buyerLabel(request: RequestEntity): string {
    return request.buyer.displayName?.trim() || request.buyer.email;
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
    const isSellerSide = Boolean(viewer && canTrade(viewer.role));
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
        isSellerSide &&
          requestOpen &&
          viewer &&
          request.buyerId !== viewer.id &&
          !hasActiveQuote,
      ),
      canMessageBuyer: Boolean(
        isSellerSide && viewer && request.buyerId !== viewer.id && requestOpen,
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
