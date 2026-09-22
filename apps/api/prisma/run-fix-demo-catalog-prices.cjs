/**
 * Align the 39 existing @agrobridge.local demo catalog Products with
 * DEMO_CATALOG_PRICES (PR #185).
 *
 * This is NOT a seed. It never deletes or recreates records. It updates only
 * Product.priceFrom, Product.priceCurrency, and Product.unit after a fully
 * validated plan. Full demo seed must NOT be used on public production.
 *
 * Default mode is dry-run. --apply is intentionally explicit and is never
 * invoked by production startup or `db:seed`.
 *
 *   node ./prisma/run-fix-demo-catalog-prices.cjs
 *   node ./prisma/run-fix-demo-catalog-prices.cjs --apply
 */
const path = require('path');

process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');
require('ts-node/register/transpile-only');

const { PrismaClient } = require('@prisma/client');
const {
  DemoCatalogPriceFixAbortError,
  runDemoCatalogPriceFix,
} = require('../src/demo-data/fix-demo-catalog-prices');

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    await runDemoCatalogPriceFix({
      prisma,
      apply,
      env: process.env,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error instanceof DemoCatalogPriceFixAbortError || error?.name === 'DemoCatalogPriceFixAbortError') {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
