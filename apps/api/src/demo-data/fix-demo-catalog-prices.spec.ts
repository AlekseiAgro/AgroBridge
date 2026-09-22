import { readFileSync } from 'fs';
import { join } from 'path';
import { DEMO_CATALOG_PRICES } from './demo-catalog-prices';
import {
  DEMO_CATALOG_PRICE_FIX_FIELDS,
  DRY_RUN_FOOTER,
  DemoCatalogPriceFixAbortError,
  EXPECTED_DEMO_CATALOG_PRODUCT_COUNT,
  applyDemoCatalogPriceFix,
  buildDemoCatalogPriceUpdateData,
  expectedDemoCatalogTitles,
  formatDryRunReport,
  numericPrice,
  runDemoCatalogPriceFix,
  validateAndBuildDemoCatalogPricePlan,
  type DemoCatalogPriceFixPrisma,
} from './fix-demo-catalog-prices';

const API_ROOT = join(__dirname, '../..');

function source(rel: string): string {
  return readFileSync(join(API_ROOT, rel), 'utf8');
}

type FixtureProduct = {
  id: string;
  title: string;
  priceFrom: unknown;
  priceCurrency: string | null;
  unit: string | null;
  owner: { email: string };
};

function staleFixtureProducts(
  overrides: Partial<Record<string, Partial<FixtureProduct>>> = {},
): FixtureProduct[] {
  return DEMO_CATALOG_PRICES.map((row, index) => ({
    id: `prod-${String(index + 1).padStart(2, '0')}`,
    title: row.title,
    priceFrom: { toNumber: () => 99.99, toString: () => '99.99' },
    priceCurrency: 'EUR',
    unit: row.unit === 'kg' && row.title === 'Guria mandarins' ? 'box' : row.unit,
    owner: { email: `farmer-demo-${index + 1}@agrobridge.local` },
    ...overrides[row.title],
  }));
}

function matchingFixtureProducts(): FixtureProduct[] {
  return DEMO_CATALOG_PRICES.map((row, index) => ({
    id: `prod-${String(index + 1).padStart(2, '0')}`,
    title: row.title,
    priceFrom: row.priceFrom,
    priceCurrency: row.priceCurrency,
    unit: row.unit,
    owner: { email: `farmer-demo-${index + 1}@agrobridge.local` },
  }));
}

function mockPrisma(products: FixtureProduct[]): {
  prisma: DemoCatalogPriceFixPrisma;
  updates: Array<{ where: { id: string }; data: Record<string, unknown> }>;
  writes: { update: number; create: number; delete: number; deleteMany: number; transaction: number };
} {
  const updates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
  const writes = { update: 0, create: 0, delete: 0, deleteMany: 0, transaction: 0 };

  const productApi = {
    findMany: jest.fn().mockResolvedValue(products),
    update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      writes.update += 1;
      updates.push(args);
      return args;
    }),
    create: jest.fn(async () => {
      writes.create += 1;
      throw new Error('create must not be used');
    }),
    delete: jest.fn(async () => {
      writes.delete += 1;
      throw new Error('delete must not be used');
    }),
    deleteMany: jest.fn(async () => {
      writes.deleteMany += 1;
      throw new Error('deleteMany must not be used');
    }),
  };

  const prisma = {
    product: productApi,
    $transaction: jest.fn(async (fn: (tx: { product: typeof productApi }) => Promise<unknown>) => {
      writes.transaction += 1;
      return fn({ product: productApi });
    }),
  };

  return { prisma: prisma as unknown as DemoCatalogPriceFixPrisma, updates, writes };
}

describe('demo catalog price data-fix', () => {
  it('covers exactly the 39 DEMO_CATALOG_PRICES titles and does not duplicate them', () => {
    expect(DEMO_CATALOG_PRICES).toHaveLength(39);
    expect(EXPECTED_DEMO_CATALOG_PRODUCT_COUNT).toBe(39);
    expect(expectedDemoCatalogTitles()).toHaveLength(39);
    expect(new Set(expectedDemoCatalogTitles()).size).toBe(39);
    expect(expectedDemoCatalogTitles()).toEqual(DEMO_CATALOG_PRICES.map((row) => row.title));

    const impl = source('src/demo-data/fix-demo-catalog-prices.ts');
    expect(impl).toContain("from './demo-catalog-prices'");
    expect(impl).toContain('DEMO_CATALOG_PRICES');
    expect(impl).not.toContain("title: 'Premium bay leaf grade A'");
    expect(impl).not.toContain("title: 'Saperavi qvevri 2024'");
  });

  it('aborts when a DEMO_CATALOG_PRICES title is missing', () => {
    const products = staleFixtureProducts().filter((row) => row.title !== 'Imereti potatoes');
    expect(() => validateAndBuildDemoCatalogPricePlan(products)).toThrow(
      DemoCatalogPriceFixAbortError,
    );
    expect(() => validateAndBuildDemoCatalogPricePlan(products)).toThrow(/missing DEMO_CATALOG_PRICES title: Imereti potatoes/);
    expect(() => validateAndBuildDemoCatalogPricePlan(products)).toThrow(/matched product count is 38/);
  });

  it('aborts when a title appears more than once', () => {
    const products = staleFixtureProducts();
    products[0] = { ...products[1], id: 'dup-id' };
    expect(() => validateAndBuildDemoCatalogPricePlan(products)).toThrow(/duplicate title/);
    expect(() => validateAndBuildDemoCatalogPricePlan(products)).toThrow(/not uniquely mapped/);
  });

  it('aborts when an unexpected title is included', () => {
    const products = staleFixtureProducts();
    products[0] = { ...products[0], title: 'Unexpected live listing' };
    expect(() => validateAndBuildDemoCatalogPricePlan(products)).toThrow(/unexpected title included: Unexpected live listing/);
  });

  it('aborts when a matched product is not owned by a demo user', () => {
    const products = staleFixtureProducts({
      'Guria mandarins': {
        owner: { email: 'seller@example.com' },
      },
    });
    expect(() => validateAndBuildDemoCatalogPricePlan(products)).toThrow(
      /non-demo owner matched: Guria mandarins owned by seller@example.com/,
    );
  });

  it('aborts when ADMIN_EMAIL is matched', () => {
    const products = staleFixtureProducts({
      'Saperavi qvevri 2024': {
        owner: { email: 'admin@agrobridge.local' },
      },
    });
    expect(() =>
      validateAndBuildDemoCatalogPricePlan(products, {
        ADMIN_EMAIL: 'admin@agrobridge.local',
      }),
    ).toThrow(/ADMIN_EMAIL \(admin@agrobridge.local\) is matched: Saperavi qvevri 2024/);
  });

  it('generates only priceFrom/priceCurrency/unit changes, including the three unit fixes', () => {
    const products = staleFixtureProducts({
      'Guria mandarins': { priceFrom: 2.5, priceCurrency: 'EUR', unit: 'box' },
      'Imereti potatoes': { priceFrom: 180, priceCurrency: 'EUR', unit: 'ton' },
      'Sweet peppers mix': { priceFrom: 8, priceCurrency: 'EUR', unit: 'box' },
      'Saperavi qvevri 2024': { priceFrom: 15, priceCurrency: 'EUR', unit: 'bottle' },
      'Georgian hazelnuts (shelled)': { priceFrom: 24, priceCurrency: 'USD', unit: 'kg' },
    });

    const plan = validateAndBuildDemoCatalogPricePlan(products);
    expect(plan.matched).toBe(39);
    expect(plan.updated).toBe(37);
    expect(plan.unchanged).toBe(2);

    const mandarins = plan.changes.find((change) => change.title === 'Guria mandarins');
    expect(mandarins).toEqual({
      id: products.find((row) => row.title === 'Guria mandarins')?.id,
      title: 'Guria mandarins',
      current: { priceFrom: 2.5, priceCurrency: 'EUR', unit: 'box' },
      target: { priceFrom: 4.5, priceCurrency: 'GEL', unit: 'kg' },
    });

    const potatoes = plan.changes.find((change) => change.title === 'Imereti potatoes');
    expect(potatoes?.current).toEqual({ priceFrom: 180, priceCurrency: 'EUR', unit: 'ton' });
    expect(potatoes?.target).toEqual({ priceFrom: 1.8, priceCurrency: 'GEL', unit: 'kg' });

    const peppers = plan.changes.find((change) => change.title === 'Sweet peppers mix');
    expect(peppers?.target).toEqual({ priceFrom: 7, priceCurrency: 'GEL', unit: 'kg' });

    for (const change of plan.changes) {
      expect(Object.keys(change.target).sort()).toEqual([...DEMO_CATALOG_PRICE_FIX_FIELDS].sort());
      expect(change.target).not.toHaveProperty('stock');
      expect(change.target).not.toHaveProperty('minQuantity');
      expect(change.target).not.toHaveProperty('maxQuantity');
      expect(change.target).not.toHaveProperty('currentStock');
      expect(change.target).not.toHaveProperty('monthlyProduction');
      expect(change.target).not.toHaveProperty('maxAnnualProduction');
      expect(change.target).not.toHaveProperty('id');
      expect(change.target).not.toHaveProperty('title');
      expect(change.target).not.toHaveProperty('farmId');
    }
  });

  it('keeps unrelated Product fields out of the update payload', () => {
    const payload = buildDemoCatalogPriceUpdateData(
      DEMO_CATALOG_PRICES.find((row) => row.title === 'Imereti potatoes')!,
    );
    expect(payload).toEqual({ priceFrom: 1.8, priceCurrency: 'GEL', unit: 'kg' });
    expect(Object.keys(payload)).toEqual(['priceFrom', 'priceCurrency', 'unit']);
  });

  it('produces zero updates when records already match DEMO_CATALOG_PRICES', () => {
    const plan = validateAndBuildDemoCatalogPricePlan(matchingFixtureProducts());
    expect(plan).toEqual({
      matched: 39,
      updated: 0,
      unchanged: 39,
      changes: [],
    });
    expect(formatDryRunReport(plan)).toContain('Products requiring changes: 0');
    expect(formatDryRunReport(plan)).toContain(DRY_RUN_FOOTER);
  });

  it('treats Prisma Decimal-like values as already-correct when they match', () => {
    const products = matchingFixtureProducts().map((row) => ({
      ...row,
      priceFrom: { toNumber: () => Number(row.priceFrom), toString: () => String(row.priceFrom) },
    }));
    const plan = validateAndBuildDemoCatalogPricePlan(products);
    expect(plan.updated).toBe(0);
    expect(numericPrice({ toNumber: () => 4.5 })).toBe(4.5);
  });

  it('dry-run produces zero writes even when changes are required', async () => {
    const { prisma, updates, writes } = mockPrisma(staleFixtureProducts());
    const result = await runDemoCatalogPriceFix({
      prisma,
      apply: false,
      log: jest.fn(),
    });

    expect(result.applied).toBe(false);
    expect(result.matched).toBe(39);
    expect(result.updated).toBeGreaterThan(0);
    expect(writes.update).toBe(0);
    expect(writes.transaction).toBe(0);
    expect(writes.create).toBe(0);
    expect(writes.delete).toBe(0);
    expect(writes.deleteMany).toBe(0);
    expect(updates).toEqual([]);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          title: { in: expectedDemoCatalogTitles() },
          owner: { email: { endsWith: '@agrobridge.local' } },
        },
      }),
    );
  });

  it('does not write when validation aborts', async () => {
    const products = staleFixtureProducts().slice(0, 10);
    const { prisma, writes } = mockPrisma(products);
    await expect(runDemoCatalogPriceFix({ prisma, apply: true, log: jest.fn() })).rejects.toBeInstanceOf(
      DemoCatalogPriceFixAbortError,
    );
    expect(writes.update).toBe(0);
    expect(writes.transaction).toBe(0);
    expect(writes.create).toBe(0);
    expect(writes.delete).toBe(0);
    expect(writes.deleteMany).toBe(0);
  });

  it('applies updates by Product ID in one transaction and is idempotent', async () => {
    const first = mockPrisma(staleFixtureProducts());
    const firstResult = await runDemoCatalogPriceFix({
      prisma: first.prisma,
      apply: true,
      log: jest.fn(),
    });

    expect(firstResult.applied).toBe(true);
    expect(firstResult.matched).toBe(39);
    expect(first.writes.transaction).toBe(1);
    expect(first.writes.update).toBe(firstResult.updated);
    expect(first.writes.create).toBe(0);
    expect(first.writes.delete).toBe(0);
    expect(first.writes.deleteMany).toBe(0);
    expect(first.updates.every((item) => Object.keys(item.data).sort().join(',') === 'priceCurrency,priceFrom,unit')).toBe(
      true,
    );
    expect(first.updates.map((item) => item.where.id).sort()).toEqual(
      firstResult.changes.map((change) => change.id).sort(),
    );

    const second = mockPrisma(matchingFixtureProducts());
    const secondResult = await runDemoCatalogPriceFix({
      prisma: second.prisma,
      apply: true,
      log: jest.fn(),
    });
    expect(secondResult.updated).toBe(0);
    expect(secondResult.unchanged).toBe(39);
    expect(second.writes.update).toBe(0);
    expect(second.writes.transaction).toBe(0);
    expect(second.writes.create).toBe(0);
    expect(second.writes.delete).toBe(0);

    await applyDemoCatalogPriceFix(second.prisma, secondResult);
    expect(second.writes.update).toBe(0);
    expect(second.writes.transaction).toBe(0);
  });

  it('prints a dry-run report with title, id, current, and target values', () => {
    const products = matchingFixtureProducts();
    products[0] = {
      ...products[0],
      priceFrom: 99,
      priceCurrency: 'EUR',
      unit: 'box',
    };
    const plan = validateAndBuildDemoCatalogPricePlan(products);
    const report = formatDryRunReport(plan);
    expect(report).toContain('Matched products: 39');
    expect(report).toContain('Products requiring changes: 1');
    expect(report).toContain(`- ${products[0].title}`);
    expect(report).toContain(`Product ID: ${products[0].id}`);
    expect(report).toContain('current: 99.00 EUR / box');
    expect(report).toContain(
      `target:  ${DEMO_CATALOG_PRICES[0].priceFrom.toFixed(2)} ${DEMO_CATALOG_PRICES[0].priceCurrency} / ${DEMO_CATALOG_PRICES[0].unit}`,
    );
    expect(report).toContain(DRY_RUN_FOOTER);
  });

  it('never uses create/delete operations in the data-fix source', () => {
    const impl = source('src/demo-data/fix-demo-catalog-prices.ts');
    const cli = source('prisma/run-fix-demo-catalog-prices.cjs');
    for (const text of [impl, cli]) {
      expect(text).not.toMatch(/\.(deleteMany|delete|create|createMany)\s*\(/);
      expect(text).not.toContain('user.update');
      expect(text).not.toContain('farm.update');
      expect(text).not.toContain('minQuantity');
      expect(text).not.toContain('maxQuantity');
      expect(text).not.toContain('currentStock');
      expect(text).not.toContain('monthlyProduction');
      expect(text).not.toContain('maxAnnualProduction');
    }
  });

  it('loads the compiled dist artifact instead of ts-node and src', () => {
    const cli = source('prisma/run-fix-demo-catalog-prices.cjs');
    expect(cli).toContain("path.join(");
    expect(cli).toContain("'dist'");
    expect(cli).toContain("'demo-data'");
    expect(cli).toContain("'fix-demo-catalog-prices.js'");
    expect(cli).not.toContain('ts-node');
    expect(cli).not.toContain("require('../src/demo-data/fix-demo-catalog-prices')");
    expect(cli).not.toContain('TS_NODE_PROJECT');
  });

  it('compiles the data-fix and its price-table dependencies into dist', () => {
    const { execFileSync } = require('child_process');
    const { existsSync } = require('fs');
    execFileSync(
      'pnpm',
      ['exec', 'tsc', '-p', 'tsconfig.build.json', '--pretty', 'false'],
      { cwd: API_ROOT, stdio: 'pipe' },
    );
    const compiled = [
      'dist/demo-data/fix-demo-catalog-prices.js',
      'dist/demo-data/demo-catalog-prices.js',
      'dist/demo-data/demo-marketplace-identities.js',
    ];
    for (const rel of compiled) {
      expect(existsSync(join(API_ROOT, rel))).toBe(true);
    }
    const loaded = require(join(API_ROOT, 'dist/demo-data/fix-demo-catalog-prices.js'));
    expect(loaded.EXPECTED_DEMO_CATALOG_PRODUCT_COUNT).toBe(39);
    expect([...loaded.DEMO_CATALOG_PRICE_FIX_FIELDS]).toEqual([
      'priceFrom',
      'priceCurrency',
      'unit',
    ]);
    expect(typeof loaded.runDemoCatalogPriceFix).toBe('function');
  });

  it('is an explicit package script and is not hooked into seed or production startup', () => {
    const apiPackage = source('package.json');
    const rootPackage = readFileSync(join(API_ROOT, '../../package.json'), 'utf8');
    const seed = source('prisma/seed.ts');
    const seedRunner = source('prisma/run-seed.cjs');
    const entry = source('docker-entrypoint.sh');
    const dockerfile = source('Dockerfile');

    expect(apiPackage).toContain('"db:fix-demo-catalog-prices": "node ./prisma/run-fix-demo-catalog-prices.cjs"');
    expect(apiPackage).toContain('"seed": "node ./prisma/run-seed.cjs"');
    expect(rootPackage).toContain('"db:fix-demo-catalog-prices"');
    expect(seed).not.toContain('fix-demo-catalog-prices');
    expect(seed).not.toContain('runDemoCatalogPriceFix');
    expect(seedRunner).not.toContain('fix-demo-catalog-prices');
    expect(entry).not.toContain('fix-demo-catalog-prices');
    expect(entry).not.toContain('db seed');
    expect(entry).toContain('ensure-admin.cjs');
    expect(entry).toContain('exec node dist/main.js');
    expect(dockerfile).toContain('COPY --from=build /app/apps/api/dist ./apps/api/dist');
    expect(dockerfile).toContain('COPY --from=build /app/apps/api/prisma ./apps/api/prisma');
    expect(dockerfile).not.toContain('apps/api/src');
  });
});
