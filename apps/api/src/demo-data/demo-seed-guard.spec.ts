import { readFileSync } from 'fs';
import { join } from 'path';
import {
  demoMarketplaceSeedPlan,
  isDemoMarketplaceSeedAllowed,
  isProductionLikeEnv,
} from './demo-seed-guard';

describe('demo marketplace seed guard', () => {
  it('treats only NODE_ENV=production as production-like', () => {
    expect(isProductionLikeEnv({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionLikeEnv({ NODE_ENV: 'development' })).toBe(false);
    expect(isProductionLikeEnv({ NODE_ENV: 'test' })).toBe(false);
    expect(isProductionLikeEnv({})).toBe(false);
  });

  it('allows demo seed in development and test', () => {
    expect(isDemoMarketplaceSeedAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(isDemoMarketplaceSeedAllowed({ NODE_ENV: 'test' })).toBe(true);
    expect(isDemoMarketplaceSeedAllowed({})).toBe(true);
    expect(demoMarketplaceSeedPlan({ NODE_ENV: 'development' }).allowReferenceData).toBe(true);
  });

  it('blocks demo seed in production unless ALLOW_DEMO_SEED=true', () => {
    const blocked = demoMarketplaceSeedPlan({ NODE_ENV: 'production' });
    expect(blocked.allowDemoMarketplace).toBe(false);
    expect(blocked.allowReferenceData).toBe(true);
    expect(blocked.blockedReason).toMatch(/ALLOW_DEMO_SEED=true/);

    expect(
      isDemoMarketplaceSeedAllowed({
        NODE_ENV: 'production',
        ALLOW_DEMO_SEED: 'true',
      }),
    ).toBe(true);
    expect(
      isDemoMarketplaceSeedAllowed({
        NODE_ENV: 'production',
        ALLOW_DEMO_SEED: '1',
      }),
    ).toBe(false);
  });

  it('wires the production guard into prisma/seed.ts', () => {
    const seed = readFileSync(join(__dirname, '../../prisma/seed.ts'), 'utf8');
    expect(seed).toContain('demoMarketplaceSeedPlan');
    expect(seed).toContain('allowDemoMarketplace');
    expect(seed).toContain('ensureLegalDocuments');
    expect(seed).toContain('Skipping demo farmers');
  });

  it('does not auto-run marketplace seed from the production entrypoint', () => {
    const entry = readFileSync(join(__dirname, '../../docker-entrypoint.sh'), 'utf8');
    expect(entry).toContain('ensure-admin.cjs');
    expect(entry).toContain('migrate deploy');
    expect(entry).not.toContain('db seed');
    expect(entry).not.toContain('run-seed');
    expect(entry).not.toContain('ALLOW_DEMO_SEED');
  });
});
