import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    farm: {
      update: jest.fn(),
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

  function sellerWithFarm(farmOverrides: Record<string, unknown> = {}) {
    return {
      id: 'u1',
      email: 'secret@example.com',
      displayName: 'Nino',
      avatarUrl: null,
      role: 'farmer',
      sellerType: 'individual',
      buyerType: null,
      createdAt: new Date('2026-03-15T10:00:00.000Z'),
      farm: {
        id: 'f1',
        name: 'Kakheti Orchards',
        region: 'kakheti',
        description: 'Original hazelnut orchard',
        sourceLocale: 'en',
        history: null,
        ownershipType: null,
        exportMarkets: [],
        translations: [],
        _count: { products: 1 },
        ...farmOverrides,
      },
    };
  }

  it('shows a completed farm translation for the requested locale and keeps the source description', async () => {
    prisma.user.findUnique.mockResolvedValue(
      sellerWithFarm({
        translations: [
          {
            locale: 'de',
            description: 'Haselnussgarten',
            history: null,
            ownershipType: null,
            exportMarkets: [],
            status: 'completed',
          },
        ],
      }),
    );
    ratings.summaryForUser.mockResolvedValue({ average: null, count: 0 });
    prisma.rfq.count.mockResolvedValue(0);

    const profile = await service.getPublicProfile('u1', 'de', 'ru');

    expect(profile.farm?.name).toBe('Kakheti Orchards');
    expect(profile.farm?.description).toBe('Original hazelnut orchard');
    expect(profile.farm?.source).toEqual({
      locale: 'en',
      description: 'Original hazelnut orchard',
    });
    expect(profile.farm?.display).toEqual({
      locale: 'de',
      description: 'Haselnussgarten',
      translationStatus: 'completed',
    });
    expect(profile).not.toHaveProperty('email');
    expect(profile.farm).not.toHaveProperty('history');
    expect(prisma.farm.update).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original farm description when translation is missing, pending, or failed', async () => {
    ratings.summaryForUser.mockResolvedValue({ average: null, count: 0 });
    prisma.rfq.count.mockResolvedValue(0);

    prisma.user.findUnique.mockResolvedValue(
      sellerWithFarm({
        translations: [
          {
            locale: 'fr',
            description: null,
            history: null,
            ownershipType: null,
            exportMarkets: [],
            status: 'pending',
          },
        ],
      }),
    );
    const pending = await service.getPublicProfile('u1', 'fr');
    expect(pending.farm?.display?.description).toBe('Original hazelnut orchard');
    expect(pending.farm?.display?.translationStatus).toBe('pending');
    expect(pending.farm?.description).toBe('Original hazelnut orchard');

    prisma.user.findUnique.mockResolvedValue(
      sellerWithFarm({
        translations: [
          {
            locale: 'fr',
            description: 'broken',
            history: null,
            ownershipType: null,
            exportMarkets: [],
            status: 'failed',
          },
        ],
      }),
    );
    const failed = await service.getPublicProfile('u1', 'fr');
    expect(failed.farm?.display?.description).toBe('Original hazelnut orchard');
    expect(failed.farm?.display?.translationStatus).toBe('failed');
    expect(prisma.farm.update).not.toHaveBeenCalled();
  });

  it('uses the signed-in viewer locale when the request does not pass one', async () => {
    prisma.user.findUnique.mockResolvedValue(
      sellerWithFarm({
        translations: [
          {
            locale: 'ka',
            description: 'თხილის ბაღი',
            history: null,
            ownershipType: null,
            exportMarkets: [],
            status: 'completed',
          },
        ],
      }),
    );
    ratings.summaryForUser.mockResolvedValue({ average: null, count: 0 });
    prisma.rfq.count.mockResolvedValue(0);

    const profile = await service.getPublicProfile('u1', undefined, 'ka');

    expect(profile.farm?.display?.locale).toBe('ka');
    expect(profile.farm?.display?.description).toBe('თხილის ბაღი');
    expect(profile.farm?.description).toBe('Original hazelnut orchard');
  });
});
