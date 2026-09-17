import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseRequestsService } from './purchase-requests.service';

function quoteRow(id: string, farmId: string, ownerEmail: string) {
  return {
    id,
    requestId: 'r1',
    farmId,
    status: 'pending',
    priceAmount: { toFixed: () => '10.00' },
    currency: 'USD',
    quantity: null,
    unit: null,
    message: null,
    validUntil: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    farm: {
      id: farmId,
      name: `Farm ${farmId}`,
      region: null,
      ownerId: `owner-${farmId}`,
      owner: { email: ownerEmail, locale: 'en', displayName: null },
    },
  };
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    buyerId: 'b1',
    title: 'Blueberries',
    category: 'berries',
    quantity: '1t',
    unit: null,
    variety: null,
    packaging: null,
    destinationCountry: null,
    message: null,
    status: 'open',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    buyer: { id: 'b1', displayName: 'Buyer Ltd', email: 'buyer@example.com', locale: 'en' },
    quotes: [quoteRow('q1', 'farm-a', 'a@example.com'), quoteRow('q2', 'farm-b', 'b@example.com')],
    ...overrides,
  };
}

const buyer = {
  id: 'b1',
  email: 'buyer@example.com',
  role: 'buyer',
  locale: 'en',
  displayName: 'Buyer Ltd',
} as never;

describe('PurchaseRequestsService', () => {
  const tx = {
    purchaseRequest: { updateMany: jest.fn() },
    purchaseQuote: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const prisma = {
    purchaseRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    purchaseQuote: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    farm: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const subscriptions = { notifyNewPurchaseRequest: jest.fn().mockResolvedValue(undefined) };
  const notifications = {
    notifyPurchaseQuoteReceived: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseQuoteAccepted: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseQuoteDeclined: jest.fn().mockResolvedValue(undefined),
    notifyPurchaseRequestWithdrawn: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PurchaseRequestsService(
    prisma as never,
    subscriptions as never,
    notifications as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx));
    tx.purchaseQuote.findMany.mockResolvedValue([]);
    tx.purchaseQuote.updateMany.mockResolvedValue({ count: 1 });
    tx.purchaseQuote.create.mockResolvedValue({});
    tx.purchaseQuote.update.mockResolvedValue({});
    tx.purchaseRequest.updateMany.mockResolvedValue({ count: 1 });
  });

  // Commit 23e31b6 opened buying and selling to every marketplace account. The role is no
  // longer what separates the two sides of a purchase request; ownership is.
  it('lets any signed-in marketplace account publish a purchase request', async () => {
    prisma.purchaseRequest.create.mockResolvedValue(requestRow({ quotes: [] }));

    await expect(
      service.create(
        {
          id: 'f1',
          email: 'farmer@example.com',
          role: 'farmer',
          locale: 'en',
          displayName: 'Farmer',
        } as never,
        { title: 'Blueberries', category: 'berries', quantity: '1' },
      ),
    ).resolves.toMatchObject({ title: 'Blueberries' });
  });

  describe('acceptQuote', () => {
    beforeEach(() => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow());
    });

    it('awards the deal only by moving the request out of open', async () => {
      await service.acceptQuote(buyer, 'r1', 'q1');

      expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'open' },
        data: { status: 'fulfilled' },
      });
      expect(tx.purchaseQuote.updateMany).toHaveBeenCalledWith({
        where: { id: 'q1', requestId: 'r1', status: 'pending' },
        data: { status: 'accepted' },
      });
    });

    it('refuses when another acceptance already claimed the request', async () => {
      tx.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptQuote(buyer, 'r1', 'q1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      // The losing caller must not tell anyone it won.
      expect(notifications.notifyPurchaseQuoteAccepted).not.toHaveBeenCalled();
      expect(tx.purchaseQuote.updateMany).not.toHaveBeenCalled();
    });

    it('rolls back rather than fulfilling a request whose quote vanished', async () => {
      tx.purchaseQuote.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.acceptQuote(buyer, 'r1', 'q1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(notifications.notifyPurchaseQuoteAccepted).not.toHaveBeenCalled();
    });

    it('tells the winner and every auto-declined supplier once', async () => {
      tx.purchaseQuote.findMany.mockResolvedValue([quoteRow('q2', 'farm-b', 'b@example.com')]);

      await service.acceptQuote(buyer, 'r1', 'q1');

      expect(notifications.notifyPurchaseQuoteAccepted).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPurchaseQuoteAccepted).toHaveBeenCalledWith({
        farmer: { email: 'a@example.com', locale: 'en', displayName: null },
        buyerName: 'Buyer Ltd',
        title: 'Blueberries',
      });
      expect(notifications.notifyPurchaseQuoteDeclined).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPurchaseQuoteDeclined).toHaveBeenCalledWith(
        expect.objectContaining({
          farmer: { email: 'b@example.com', locale: 'en', displayName: null },
        }),
      );
    });

    it('keeps the accepted deal when the mail provider is down', async () => {
      notifications.notifyPurchaseQuoteAccepted.mockRejectedValueOnce(new Error('resend down'));

      await expect(service.acceptQuote(buyer, 'r1', 'q1')).resolves.toBeDefined();
      expect(tx.purchaseRequest.updateMany).toHaveBeenCalled();
    });

    it('declines every other pending quote in the same transaction', async () => {
      await service.acceptQuote(buyer, 'r1', 'q1');

      expect(tx.purchaseQuote.updateMany).toHaveBeenCalledWith({
        where: { requestId: 'r1', id: { not: 'q1' }, status: 'pending' },
        data: { status: 'declined' },
      });
    });

    it('does not open a transaction for a request that is already fulfilled', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow({ status: 'fulfilled' }));

      await expect(service.acceptQuote(buyer, 'r1', 'q1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not open a transaction for a closed request', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow({ status: 'closed' }));

      await expect(service.acceptQuote(buyer, 'r1', 'q1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not open a transaction for a cancelled request', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow({ status: 'cancelled' }));

      await expect(service.acceptQuote(buyer, 'r1', 'q1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an already accepted quote without writing', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(
        requestRow({
          quotes: [
            { ...quoteRow('q1', 'farm-a', 'a@example.com'), status: 'accepted' },
            quoteRow('q2', 'farm-b', 'b@example.com'),
          ],
        }),
      );

      await expect(service.acceptQuote(buyer, 'r1', 'q1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a quote that belongs to a different purchase request', async () => {
      await expect(service.acceptQuote(buyer, 'r1', 'quote-from-elsewhere')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a caller who does not own the request', async () => {
      await expect(
        service.acceptQuote(
          { id: 'other', email: 'x@example.com', role: 'buyer', locale: 'en' } as never,
          'r1',
          'q1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a caller who cannot trade', async () => {
      await expect(
        service.acceptQuote(
          { id: 'b1', email: 'buyer@example.com', role: 'support', locale: 'en' } as never,
          'r1',
          'q1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.purchaseRequest.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a missing request as not found, not as a conflict', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(null);

      await expect(service.acceptQuote(buyer, 'missing', 'q1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('declineQuote', () => {
    beforeEach(() => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow());
      prisma.purchaseQuote.updateMany.mockResolvedValue({ count: 1 });
    });

    it('notifies the supplier exactly once', async () => {
      await service.declineQuote(buyer, 'r1', 'q1');

      expect(notifications.notifyPurchaseQuoteDeclined).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPurchaseQuoteDeclined).toHaveBeenCalledWith({
        farmer: { email: 'a@example.com', locale: 'en', displayName: null },
        buyerName: 'Buyer Ltd',
        title: 'Blueberries',
      });
    });

    it('sends nothing when the decline changed no row', async () => {
      prisma.purchaseQuote.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.declineQuote(buyer, 'r1', 'q1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(notifications.notifyPurchaseQuoteDeclined).not.toHaveBeenCalled();
    });
  });

  describe('close and cancel', () => {
    beforeEach(() => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow());
      tx.purchaseQuote.findMany.mockResolvedValue(requestRow().quotes);
    });

    it('closes the request and declines pending quotes in one transaction', async () => {
      await service.close(buyer, 'r1');

      expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'open' },
        data: { status: 'closed' },
      });
      expect(tx.purchaseQuote.updateMany).toHaveBeenCalledWith({
        where: { requestId: 'r1', status: 'pending' },
        data: { status: 'declined' },
      });
      expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(2);
      expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'closed', title: 'Blueberries' }),
      );
      expect(notifications.notifyPurchaseQuoteDeclined).not.toHaveBeenCalled();
    });

    it('cancels the request and declines pending quotes in one transaction', async () => {
      await service.cancel(buyer, 'r1');

      expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'open' },
        data: { status: 'cancelled' },
      });
      expect(tx.purchaseQuote.updateMany).toHaveBeenCalledWith({
        where: { requestId: 'r1', status: 'pending' },
        data: { status: 'declined' },
      });
      expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'cancelled' }),
      );
    });

    it('does not repeat the announcement when the request had already moved on', async () => {
      tx.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.close(buyer, 'r1')).rejects.toBeInstanceOf(ConflictException);
      expect(tx.purchaseQuote.updateMany).not.toHaveBeenCalled();
      expect(notifications.notifyPurchaseRequestWithdrawn).not.toHaveBeenCalled();
    });

    it('leaves already-accepted and already-declined quotes out of the announcement', async () => {
      tx.purchaseQuote.findMany.mockResolvedValue([quoteRow('q2', 'farm-b', 'b@example.com')]);

      await service.close(buyer, 'r1');

      expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledTimes(1);
      expect(notifications.notifyPurchaseRequestWithdrawn).toHaveBeenCalledWith(
        expect.objectContaining({
          farmer: { email: 'b@example.com', locale: 'en', displayName: null },
        }),
      );
    });

    it('rejects a caller who does not own the request', async () => {
      await expect(
        service.close(
          { id: 'other', email: 'x@example.com', role: 'buyer', locale: 'en' } as never,
          'r1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a supplier who tries to close someone else's request", async () => {
      await expect(
        service.cancel(
          { id: 'owner-a', email: 'a@example.com', role: 'farmer', locale: 'en' } as never,
          'r1',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not open a transaction for a request that is already closed', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow({ status: 'closed' }));

      await expect(service.close(buyer, 'r1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('createQuote', () => {
    const farmer = {
      id: 'owner-a',
      email: 'a@example.com',
      role: 'farmer',
      locale: 'en',
    } as never;

    beforeEach(() => {
      prisma.farm.findUnique.mockResolvedValue({ id: 'farm-a', name: 'Farm farm-a' });
      prisma.purchaseRequest.findUnique.mockResolvedValue(requestRow({ quotes: [] }));
    });

    it('locks the open purchase request before inserting the quote', async () => {
      await service.createQuote(farmer, 'r1', { priceAmount: '12.5', currency: 'USD' } as never);

      expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', status: 'open' },
        data: { status: 'open' },
      });
      expect(tx.purchaseQuote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          requestId: 'r1',
          farmId: 'farm-a',
          status: 'pending',
          currency: 'USD',
        }),
      });
      expect(prisma.purchaseQuote.create).not.toHaveBeenCalled();
    });

    it('tells the buyer a quote arrived', async () => {
      await service.createQuote(farmer, 'r1', { priceAmount: '12.5', currency: 'USD' } as never);

      expect(notifications.notifyPurchaseQuoteReceived).toHaveBeenCalledWith({
        buyer: { id: 'b1', displayName: 'Buyer Ltd', email: 'buyer@example.com', locale: 'en' },
        farmName: 'Farm farm-a',
        title: 'Blueberries',
        priceAmount: '12.50',
        currency: 'USD',
        requestId: 'r1',
      });
    });

    it('stores the quote even when the buyer cannot be emailed', async () => {
      notifications.notifyPurchaseQuoteReceived.mockRejectedValueOnce(new Error('resend down'));

      await expect(
        service.createQuote(farmer, 'r1', { priceAmount: '12.5', currency: 'USD' } as never),
      ).resolves.toBeDefined();
      expect(tx.purchaseQuote.create).toHaveBeenCalled();
    });

    it('does not insert a quote or mail the buyer when the request left OPEN mid-flight', async () => {
      tx.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.createQuote(farmer, 'r1', { priceAmount: '12.5', currency: 'USD' } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.purchaseQuote.create).not.toHaveBeenCalled();
      expect(tx.purchaseQuote.update).not.toHaveBeenCalled();
      expect(notifications.notifyPurchaseQuoteReceived).not.toHaveBeenCalled();
    });

    it('reactivates a withdrawn quote instead of inserting a second row', async () => {
      prisma.purchaseRequest.findUnique.mockResolvedValue(
        requestRow({
          quotes: [{ ...quoteRow('q1', 'farm-a', 'a@example.com'), status: 'withdrawn' }],
        }),
      );

      await service.createQuote(farmer, 'r1', { priceAmount: '15', currency: 'EUR' } as never);

      expect(tx.purchaseQuote.update).toHaveBeenCalledWith({
        where: { id: 'q1' },
        data: expect.objectContaining({ status: 'pending', currency: 'EUR' }),
      });
      expect(tx.purchaseQuote.create).not.toHaveBeenCalled();
      expect(notifications.notifyPurchaseQuoteReceived).toHaveBeenCalledTimes(1);
    });
  });
});
