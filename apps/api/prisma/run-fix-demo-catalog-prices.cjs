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
 * Production images copy prisma/ and dist/, not apps/api/src. This wrapper
 * therefore loads the compiled implementation from dist/ and does not use
 * ts-node.
 *
 *   node ./prisma/run-fix-demo-catalog-prices.cjs
 *   node ./prisma/run-fix-demo-catalog-prices.cjs --apply
 */
const path = require('path');

const { PrismaClient } = require('@prisma/client');

function loadCompiledFix() {
  const compiledPath = path.join(
    __dirname,
    '..',
    'dist',
    'demo-data',
    'fix-demo-catalog-prices.js',
  );
  try {
    return require(compiledPath);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      error.message =
        `Compiled demo catalog price fix not found at ${compiledPath}. ` +
        'Build the API first (`pnpm --filter @agrobridge/api build`). ' +
        'This command does not load apps/api/src or ts-node.';
    }
    throw error;
  }
}

const { DemoCatalogPriceFixAbortError, runDemoCatalogPriceFix } = loadCompiledFix();

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
