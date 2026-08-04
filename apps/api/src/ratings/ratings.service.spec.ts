import { NotFoundException } from '@nestjs/common';
import { RatingsService } from './ratings.service';

describe('RatingsService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    rating: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
    },
    rfq: { findUnique: jest.fn() },
  };

  const service = new RatingsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists public reviews for a user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.rating.findMany.mockResolvedValue([
      {
        id: 'r1',
        score: 5,
        comment: 'Great partner',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        fromUser: { id: 'u2', displayName: 'Buyer' },
      },
    ]);

    await expect(service.listForUser('u1')).resolves.toEqual({
      items: [
        {
          id: 'r1',
          score: 5,
          comment: 'Great partner',
          createdAt: '2026-08-01T10:00:00.000Z',
          fromUser: { id: 'u2', displayName: 'Buyer' },
        },
      ],
    });
  });

  it('returns 404 when listing reviews for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.listForUser('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
