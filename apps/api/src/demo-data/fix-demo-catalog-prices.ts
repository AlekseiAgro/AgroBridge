/**
 * One-time / idempotent data-fix for the 39 existing demo catalog Products.
 *
 * Why this exists
 * ---------------
 * PR #185 normalized DEMO_CATALOG_PRICES (priceFrom / priceCurrency / unit) in
 * the seed source. Production was intentionally not reseeded: the full demo
 * seed deletes and recreates demo products and cascades related RFQ / offer /
 * rating rows. Railway startup never runs `prisma db seed`. This script is the
 * targeted product-only update that was missing.
 *
 * Safety
 * ------
 * - This is NOT a seed.
 * - Default mode is dry-run. `--apply` is intentionally explicit.
 * - Full demo seed must NOT be used on the public marketplace.
 * - Only the 39 @agrobridge.local-owned titles from DEMO_CATALOG_PRICES are
 *   considered, and only Product.priceFrom, Product.priceCurrency, and
 *   Product.unit may change. Product IDs are kept. Quantity / stock / harvest /
 *   media / relations are never written.
 * - The complete plan is validated first. Any mismatch (count ≠ 39, missing /
 *   duplicate / unexpected title, non-demo owner, ADMIN_EMAIL) aborts with
 *   zero writes. `--apply` uses one Prisma transaction after that plan exists.
 */

import type { CurrencyCode, ProductUnit } from '@agrobridge/shared';
import {
  DEMO_CATALOG_PRICES,
  type DemoCatalogPrice,
} from './demo-catalog-prices';
import {
  DEMO_MARKETPLACE_EMAIL_DOMAIN,
  isDemoMarketplaceEmail,
} from './demo-marketplace-identities';

export const DEMO_CATALOG_PRICE_FIX_FIELDS = [
  'priceFrom',
  'priceCurrency',
  'unit',
] as const;

export const EXPECTED_DEMO_CATALOG_PRODUCT_COUNT = DEMO_CATALOG_PRICES.length;

export const DRY_RUN_FOOTER = 'DRY RUN ONLY — NO DATABASE CHANGES WERE MADE';

export type DemoCatalogPriceFixEnv = {
  ADMIN_EMAIL?: string;
};

export type DemoCatalogPriceTarget = {
  priceFrom: number;
  priceCurrency: CurrencyCode;
  unit: ProductUnit;
};

export type DemoCatalogPriceCurrent = {
  priceFrom: number | null;
  priceCurrency: string | null;
  unit: string | null;
};

export type DemoCatalogPriceChange = {
  id: string;
  title: string;
  current: DemoCatalogPriceCurrent;
  target: DemoCatalogPriceTarget;
};

export type DemoCatalogPriceFixPlan = {
  matched: number;
  updated: number;
  unchanged: number;
  changes: DemoCatalogPriceChange[];
};

export type DemoCatalogPriceFixResult = DemoCatalogPriceFixPlan & {
  applied: boolean;
};

export class DemoCatalogPriceFixAbortError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Demo catalog price fix aborted:\n- ${issues.join('\n- ')}`);
    this.name = 'DemoCatalogPriceFixAbortError';
    this.issues = issues;
  }
}

type LoadedDemoProduct = {
  id: string;
  title: string;
  priceFrom: unknown;
  priceCurrency: string | null;
  unit: string | null;
  owner: { email: string };
};

export type DemoCatalogPriceFixPrisma = {
  product: {
    findMany: (args: {
      where: {
        title: { in: string[] };
        owner: { email: { endsWith: string } };
      };
      select: {
        id: true;
        title: true;
        priceFrom: true;
        priceCurrency: true;
        unit: true;
        owner: { select: { email: true } };
      };
    }) => Promise<LoadedDemoProduct[]>;
    update: (args: {
      where: { id: string };
      data: DemoCatalogPriceTarget;
    }) => Promise<unknown>;
  };
  $transaction: <T>(
    fn: (tx: Pick<DemoCatalogPriceFixPrisma, 'product'>) => Promise<T>,
  ) => Promise<T>;
};

export function expectedDemoCatalogTitles(): string[] {
  return DEMO_CATALOG_PRICES.map((row) => row.title);
}

export function buildDemoCatalogPriceUpdateData(
  target: DemoCatalogPrice,
): DemoCatalogPriceTarget {
  return {
    priceFrom: target.priceFrom,
    priceCurrency: target.priceCurrency,
    unit: target.unit,
  };
}

export function numericPrice(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object') {
    const decimal = value as { toNumber?: () => number; toString?: () => string };
    if (typeof decimal.toNumber === 'function') {
      const parsed = decimal.toNumber();
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof decimal.toString === 'function') {
      const parsed = Number(decimal.toString());
      return Number.isFinite(parsed) ? parsed : null;
    }
  }
  return null;
}

function sameListedPrice(
  current: DemoCatalogPriceCurrent,
  target: DemoCatalogPriceTarget,
): boolean {
  if (current.priceFrom == null) return false;
  if (Math.round(current.priceFrom * 100) !== Math.round(target.priceFrom * 100)) {
    return false;
  }
  return current.priceCurrency === target.priceCurrency && current.unit === target.unit;
}

function protectedAdminEmail(env: DemoCatalogPriceFixEnv): string | null {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  return email || null;
}

export function demoCatalogPriceQuery() {
  return {
    where: {
      title: { in: expectedDemoCatalogTitles() },
      owner: { email: { endsWith: `@${DEMO_MARKETPLACE_EMAIL_DOMAIN}` } },
    },
    select: {
      id: true,
      title: true,
      priceFrom: true,
      priceCurrency: true,
      unit: true,
      owner: { select: { email: true } },
    },
  } as const;
}

export async function loadDemoCatalogProducts(
  prisma: DemoCatalogPriceFixPrisma,
): Promise<LoadedDemoProduct[]> {
  return prisma.product.findMany(demoCatalogPriceQuery());
}

export function validateAndBuildDemoCatalogPricePlan(
  products: LoadedDemoProduct[],
  env: DemoCatalogPriceFixEnv = {},
): DemoCatalogPriceFixPlan {
  const issues: string[] = [];
  const adminEmail = protectedAdminEmail(env);
  const expectedTitles = expectedDemoCatalogTitles();
  const expectedSet = new Set(expectedTitles);

  const adminMatched = products.filter(
    (product) => product.owner.email.trim().toLowerCase() === adminEmail,
  );
  if (adminMatched.length > 0) {
    issues.push(
      `ADMIN_EMAIL (${adminEmail}) is matched: ${adminMatched
        .map((product) => `${product.title} (${product.id})`)
        .join(', ')}`,
    );
  }

  const nonDemo = products.filter((product) => {
    const email = product.owner.email;
    if (adminEmail && email.trim().toLowerCase() === adminEmail) return false;
    return !isDemoMarketplaceEmail(email, { protectEmail: adminEmail });
  });
  if (nonDemo.length > 0) {
    issues.push(
      `non-demo owner matched: ${nonDemo
        .map((product) => `${product.title} owned by ${product.owner.email}`)
        .join(', ')}`,
    );
  }

  const unexpected = products.filter((product) => !expectedSet.has(product.title));
  if (unexpected.length > 0) {
    issues.push(
      `unexpected title included: ${unexpected
        .map((product) => `${product.title} (${product.id})`)
        .join(', ')}`,
    );
  }

  const byTitle = new Map<string, LoadedDemoProduct[]>();
  for (const product of products) {
    const list = byTitle.get(product.title) ?? [];
    list.push(product);
    byTitle.set(product.title, list);
  }

  const duplicates = [...byTitle.entries()].filter(([, list]) => list.length > 1);
  if (duplicates.length > 0) {
    issues.push(
      `duplicate title among matched products: ${duplicates
        .map(([title, list]) => `${title} ×${list.length}`)
        .join(', ')}`,
    );
  }

  const missing = expectedTitles.filter((title) => !byTitle.has(title));
  if (missing.length > 0) {
    issues.push(`missing DEMO_CATALOG_PRICES title: ${missing.join(', ')}`);
  }

  if (products.length !== EXPECTED_DEMO_CATALOG_PRODUCT_COUNT) {
    issues.push(
      `matched product count is ${products.length}, expected exactly ${EXPECTED_DEMO_CATALOG_PRODUCT_COUNT}`,
    );
  }

  for (const title of expectedTitles) {
    const mapped = byTitle.get(title) ?? [];
    if (mapped.length !== 1) {
      issues.push(
        `title "${title}" is not uniquely mapped to exactly one Product (found ${mapped.length})`,
      );
    }
  }

  if (issues.length > 0) {
    throw new DemoCatalogPriceFixAbortError([...new Set(issues)]);
  }

  const changes: DemoCatalogPriceChange[] = [];
  for (const row of DEMO_CATALOG_PRICES) {
    const product = byTitle.get(row.title)?.[0];
    if (!product) {
      throw new DemoCatalogPriceFixAbortError([
        `title "${row.title}" is not uniquely mapped to exactly one Product (found 0)`,
      ]);
    }
    const current: DemoCatalogPriceCurrent = {
      priceFrom: numericPrice(product.priceFrom),
      priceCurrency: product.priceCurrency,
      unit: product.unit,
    };
    const target = buildDemoCatalogPriceUpdateData(row);
    if (!sameListedPrice(current, target)) {
      changes.push({
        id: product.id,
        title: product.title,
        current,
        target,
      });
    }
  }

  return {
    matched: products.length,
    updated: changes.length,
    unchanged: products.length - changes.length,
    changes,
  };
}

export async function applyDemoCatalogPriceFix(
  prisma: DemoCatalogPriceFixPrisma,
  plan: DemoCatalogPriceFixPlan,
): Promise<DemoCatalogPriceFixPlan> {
  if (plan.matched !== EXPECTED_DEMO_CATALOG_PRODUCT_COUNT) {
    throw new DemoCatalogPriceFixAbortError([
      `matched product count is ${plan.matched}, expected exactly ${EXPECTED_DEMO_CATALOG_PRODUCT_COUNT}`,
    ]);
  }
  if (plan.changes.length === 0) {
    return plan;
  }

  await prisma.$transaction(async (tx) => {
    for (const change of plan.changes) {
      await tx.product.update({
        where: { id: change.id },
        data: {
          priceFrom: change.target.priceFrom,
          priceCurrency: change.target.priceCurrency,
          unit: change.target.unit,
        },
      });
    }
  });

  return plan;
}

function formatSnapshot(snapshot: DemoCatalogPriceCurrent | DemoCatalogPriceTarget): string {
  const price = snapshot.priceFrom == null ? 'null' : snapshot.priceFrom.toFixed(2);
  return `${price} ${snapshot.priceCurrency ?? 'null'} / ${snapshot.unit ?? 'null'}`;
}

export function formatDryRunReport(plan: DemoCatalogPriceFixPlan): string {
  const lines = [
    'Demo catalog price fix',
    `Matched products: ${plan.matched}`,
    `Products requiring changes: ${plan.updated}`,
    `Unchanged products: ${plan.unchanged}`,
  ];

  if (plan.changes.length > 0) {
    lines.push('', 'Changes:');
    for (const change of plan.changes) {
      lines.push(
        `- ${change.title}`,
        `  Product ID: ${change.id}`,
        `  current: ${formatSnapshot(change.current)}`,
        `  target:  ${formatSnapshot(change.target)}`,
      );
    }
  }

  lines.push('', DRY_RUN_FOOTER);
  return lines.join('\n');
}

export function formatApplySummary(plan: DemoCatalogPriceFixPlan): string {
  return [
    `matched = ${plan.matched}`,
    `updated = ${plan.updated}`,
    `unchanged = ${plan.unchanged}`,
  ].join('\n');
}

export async function runDemoCatalogPriceFix(options: {
  prisma: DemoCatalogPriceFixPrisma;
  apply?: boolean;
  env?: DemoCatalogPriceFixEnv;
  log?: (line: string) => void;
}): Promise<DemoCatalogPriceFixResult> {
  const log = options.log ?? console.log;
  const products = await loadDemoCatalogProducts(options.prisma);
  const plan = validateAndBuildDemoCatalogPricePlan(products, options.env ?? {});

  if (!options.apply) {
    log(formatDryRunReport(plan));
    return { ...plan, applied: false };
  }

  await applyDemoCatalogPriceFix(options.prisma, plan);
  log(formatApplySummary(plan));
  return { ...plan, applied: true };
}
