/**
 * Prisma's seed runner uses spawn() without a shell, so
 * `TS_NODE_PROJECT=... node ...` fails with ENOENT in Docker/Alpine.
 * This wrapper sets the env var in-process, then loads the TypeScript seed.
 */
const path = require('path');

process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');

require('ts-node/register/transpile-only');
require('./seed.ts');
