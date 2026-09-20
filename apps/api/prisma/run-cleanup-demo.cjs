/**
 * Dry-run (default) or apply cleanup of @agrobridge.local demo marketplace users.
 * Does not run against production unless an operator executes it.
 *
 *   node ./prisma/run-cleanup-demo.cjs
 *   node ./prisma/run-cleanup-demo.cjs --apply
 */
const path = require('path');

process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');
require('ts-node/register/transpile-only');

const { PrismaClient } = require('@prisma/client');
const {
  identifyDemoMarketplaceRecords,
  applyDemoMarketplaceCleanup,
} = require('../src/demo-data/demo-marketplace-cleanup');

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const report = await identifyDemoMarketplaceRecords(prisma);
    console.log(JSON.stringify(report, null, 2));
    if (!apply) {
      console.log(
        'Dry-run only. Re-run with --apply to delete the listed @agrobridge.local users and cascaded marketplace rows.',
      );
      return;
    }
    const applied = await applyDemoMarketplaceCleanup(prisma, report);
    console.log(
      `Deleted ${applied.userCount} demo users (${applied.farmCount} farms, ${applied.productCount} products, ${applied.purchaseRequestCount} purchase requests).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
