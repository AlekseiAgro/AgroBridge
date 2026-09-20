import type { PrismaClient } from '@prisma/client';
import { isDemoMarketplaceEmail } from './demo-marketplace-identities';

export type DemoCleanupTarget = {
  userId: string;
  email: string;
  role: string;
  farmId: string | null;
  farmName: string | null;
  productIds: string[];
  productTitles: string[];
  purchaseRequestIds: string[];
  storageKeys: string[];
};

export type DemoCleanupReport = {
  dryRun: boolean;
  protectedAdminEmail: string | null;
  userCount: number;
  farmCount: number;
  productCount: number;
  purchaseRequestCount: number;
  storageKeyCount: number;
  targets: DemoCleanupTarget[];
};

type CleanupEnv = {
  ADMIN_EMAIL?: string;
};

function protectedAdminEmail(env: CleanupEnv = process.env): string | null {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  return email || null;
}

export async function identifyDemoMarketplaceRecords(
  prisma: PrismaClient,
  env: CleanupEnv = process.env,
): Promise<DemoCleanupReport> {
  const protect = protectedAdminEmail(env);
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@agrobridge.local' } },
    select: {
      id: true,
      email: true,
      role: true,
      farm: {
        select: {
          id: true,
          name: true,
          documents: { select: { key: true } },
          images: { select: { key: true } },
          products: {
            select: {
              id: true,
              title: true,
              images: { select: { key: true } },
              videos: { select: { key: true } },
              certificates: { select: { key: true } },
            },
          },
        },
      },
      ownedProducts: {
        select: {
          id: true,
          title: true,
          images: { select: { key: true } },
          videos: { select: { key: true } },
          certificates: { select: { key: true } },
        },
      },
      purchaseRequests: { select: { id: true } },
    },
  });

  const targets: DemoCleanupTarget[] = [];
  for (const user of users) {
    if (!isDemoMarketplaceEmail(user.email, { protectEmail: protect })) {
      continue;
    }
    const productsById = new Map<
      string,
      {
        id: string;
        title: string;
        keys: string[];
      }
    >();
    const addProduct = (product: {
      id: string;
      title: string;
      images: Array<{ key: string }>;
      videos: Array<{ key: string }>;
      certificates: Array<{ key: string }>;
    }) => {
      const keys = [
        ...product.images.map((item) => item.key),
        ...product.videos.map((item) => item.key),
        ...product.certificates.map((item) => item.key),
      ];
      productsById.set(product.id, { id: product.id, title: product.title, keys });
    };
    for (const product of user.farm?.products ?? []) addProduct(product);
    for (const product of user.ownedProducts) addProduct(product);

    const farmKeys = [
      ...(user.farm?.documents.map((item) => item.key) ?? []),
      ...(user.farm?.images.map((item) => item.key) ?? []),
    ];
    const productEntries = [...productsById.values()];
    targets.push({
      userId: user.id,
      email: user.email,
      role: user.role,
      farmId: user.farm?.id ?? null,
      farmName: user.farm?.name ?? null,
      productIds: productEntries.map((item) => item.id),
      productTitles: productEntries.map((item) => item.title),
      purchaseRequestIds: user.purchaseRequests.map((item) => item.id),
      storageKeys: [...new Set([...farmKeys, ...productEntries.flatMap((item) => item.keys)])],
    });
  }

  return {
    dryRun: true,
    protectedAdminEmail: protect,
    userCount: targets.length,
    farmCount: targets.filter((target) => target.farmId).length,
    productCount: targets.reduce((sum, target) => sum + target.productIds.length, 0),
    purchaseRequestCount: targets.reduce(
      (sum, target) => sum + target.purchaseRequestIds.length,
      0,
    ),
    storageKeyCount: targets.reduce((sum, target) => sum + target.storageKeys.length, 0),
    targets,
  };
}

export async function applyDemoMarketplaceCleanup(
  prisma: PrismaClient,
  report: DemoCleanupReport,
): Promise<DemoCleanupReport> {
  const ids = report.targets.map((target) => target.userId);
  if (ids.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  return {
    ...report,
    dryRun: false,
  };
}
