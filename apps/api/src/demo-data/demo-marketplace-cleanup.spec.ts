import {
  applyDemoMarketplaceCleanup,
  identifyDemoMarketplaceRecords,
  type DemoCleanupReport,
} from './demo-marketplace-cleanup';

function userRow(overrides: {
  id: string;
  email: string;
  role?: string;
  farmName?: string | null;
  productTitle?: string;
  purchaseRequestId?: string;
}) {
  const farm =
    overrides.farmName == null
      ? null
      : {
          id: `farm-${overrides.id}`,
          name: overrides.farmName,
          documents: [{ key: `farms/${overrides.id}/documents/demo-id-card.txt` }],
          images: [],
          products: [
            {
              id: `product-${overrides.id}`,
              title: overrides.productTitle ?? 'Fresh Kakheti peaches',
              images: [{ key: `products/product-${overrides.id}/seed-fruits-overview-0.jpg` }],
              videos: [],
              certificates: [],
            },
          ],
        };
  return {
    id: overrides.id,
    email: overrides.email,
    role: overrides.role ?? 'farmer',
    farm,
    ownedProducts: farm?.products ?? [],
    purchaseRequests: overrides.purchaseRequestId
      ? [{ id: overrides.purchaseRequestId }]
      : [],
  };
}

describe('demo marketplace cleanup', () => {
  it('identifies only @agrobridge.local users and protects ADMIN_EMAIL', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          userRow({
            id: 'demo-1',
            email: 'farmer-fruits-1@agrobridge.local',
            farmName: 'Kakheti Orchard Co-op',
          }),
          userRow({
            id: 'demo-buyer',
            email: 'buyer-1@agrobridge.local',
            role: 'buyer',
            farmName: null,
            purchaseRequestId: 'pr-1',
          }),
          userRow({
            id: 'live-admin',
            email: 'admin@agrobridge.local',
            role: 'admin',
            farmName: null,
          }),
        ]),
        deleteMany: jest.fn(),
      },
    };

    const report = await identifyDemoMarketplaceRecords(prisma as never, {
      ADMIN_EMAIL: 'admin@agrobridge.local',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { endsWith: '@agrobridge.local' } },
      }),
    );
    expect(report.targets.map((target) => target.email)).toEqual([
      'farmer-fruits-1@agrobridge.local',
      'buyer-1@agrobridge.local',
    ]);
    expect(report.userCount).toBe(2);
    expect(report.farmCount).toBe(1);
    expect(report.productCount).toBe(1);
    expect(report.purchaseRequestCount).toBe(1);
    expect(report.targets[0]?.storageKeys).toEqual([
      'farms/demo-1/documents/demo-id-card.txt',
      'products/product-demo-1/seed-fruits-overview-0.jpg',
    ]);
    expect(report.dryRun).toBe(true);
  });

  it('does not invent a rule for BBB / Новый товар live test rows', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          userRow({
            id: 'live-test',
            email: 'aleksei@example.com',
            farmName: 'BBB',
            productTitle: 'Новый товар',
          }),
        ]),
        deleteMany: jest.fn(),
      },
    };

    const report = await identifyDemoMarketplaceRecords(prisma as never, {
      ADMIN_EMAIL: 'ops@agrobridge.ge',
    });
    expect(report.targets).toEqual([]);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes only previously identified users and is idempotent', async () => {
    const firstUsers = [
      userRow({
        id: 'demo-1',
        email: 'farmer-nuts-1@agrobridge.local',
        farmName: 'Samegrelo Hazelnut Grove',
      }),
    ];
    const prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(firstUsers)
          .mockResolvedValueOnce([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const first = await identifyDemoMarketplaceRecords(prisma as never, {});
    const applied = await applyDemoMarketplaceCleanup(prisma as never, first);
    expect(applied.dryRun).toBe(false);
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['demo-1'] } },
    });

    const second = await identifyDemoMarketplaceRecords(prisma as never, {});
    expect(second.targets).toEqual([]);
    await applyDemoMarketplaceCleanup(prisma as never, second);
    expect(prisma.user.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('skips deleteMany when the report is empty', async () => {
    const prisma = {
      user: { deleteMany: jest.fn() },
    };
    const empty: DemoCleanupReport = {
      dryRun: true,
      protectedAdminEmail: null,
      userCount: 0,
      farmCount: 0,
      productCount: 0,
      purchaseRequestCount: 0,
      storageKeyCount: 0,
      targets: [],
    };
    await applyDemoMarketplaceCleanup(prisma as never, empty);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });
});
