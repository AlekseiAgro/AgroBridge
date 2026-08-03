import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    rfq: {
      count: jest.fn(),
    },
  };

  const ratings = {
    summaryForUser: jest.fn(),
  };

  const service = new UsersService(prisma as never, ratings as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when user is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getPublicProfile('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a public profile without email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'secret@example.com',
      displayName: 'Elena',
      avatarUrl: null,
      role: 'buyer',
      sellerType: null,
      buyerType: 'individual',
      createdAt: new Date('2026-03-15T10:00:00.000Z'),
      farm: null,
    });
    ratings.summaryForUser.mockResolvedValue({ average: 4.5, count: 2 });
    prisma.rfq.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);

    const profile = await service.getPublicProfile('u1');

    expect(profile).toEqual({
      id: 'u1',
      displayName: 'Elena',
      avatarUrl: null,
      role: 'buyer',
      sellerType: null,
      buyerType: 'individual',
      memberSince: '2026-03-15T10:00:00.000Z',
      rating: { average: 4.5, count: 2 },
      completedDeals: 3,
      farm: null,
    });
    expect(profile).not.toHaveProperty('email');
  });
});
