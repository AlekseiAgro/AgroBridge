export type DemoSeedEnv = {
  NODE_ENV?: string;
  ALLOW_DEMO_SEED?: string;
};

export type DemoMarketplaceSeedPlan = {
  allowReferenceData: true;
  allowDemoMarketplace: boolean;
  blockedReason: string | null;
};

/**
 * Production uses NODE_ENV=production (Railway, Docker, mail/SMS guards).
 * Demo marketplace seed is fail-closed there unless ALLOW_DEMO_SEED=true.
 */
export function isProductionLikeEnv(env: DemoSeedEnv = process.env): boolean {
  return (env.NODE_ENV ?? '').trim() === 'production';
}

export function demoMarketplaceSeedPlan(
  env: DemoSeedEnv = process.env,
): DemoMarketplaceSeedPlan {
  const production = isProductionLikeEnv(env);
  const override = env.ALLOW_DEMO_SEED === 'true';
  if (production && !override) {
    return {
      allowReferenceData: true,
      allowDemoMarketplace: false,
      blockedReason:
        'Demo marketplace seed is blocked when NODE_ENV=production. ' +
        'Reference data (legal documents, categories, admin) still runs. ' +
        'Set ALLOW_DEMO_SEED=true only for an explicit staging/demo override.',
    };
  }
  return {
    allowReferenceData: true,
    allowDemoMarketplace: true,
    blockedReason: null,
  };
}

export function isDemoMarketplaceSeedAllowed(env: DemoSeedEnv = process.env): boolean {
  return demoMarketplaceSeedPlan(env).allowDemoMarketplace;
}
