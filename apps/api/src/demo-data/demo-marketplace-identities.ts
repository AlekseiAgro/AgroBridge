/** Domain used exclusively by prisma/seed.ts demo farmers and buyers. */
export const DEMO_MARKETPLACE_EMAIL_DOMAIN = 'agrobridge.local';

export const DEMO_BUYER_EMAILS = [
  'buyer-1@agrobridge.local',
  'buyer-2@agrobridge.local',
  'buyer-3@agrobridge.local',
  'buyer-4@agrobridge.local',
] as const;

export const DEMO_OBSOLETE_FARMER_EMAILS = [
  'farmer-herbs-1@agrobridge.local',
  'farmer-herbs-2@agrobridge.local',
  'farmer-herbs-3@agrobridge.local',
] as const;

export function demoFarmerEmail(category: string, oneBasedIndex: number): string {
  return `farmer-${category}-${oneBasedIndex}@${DEMO_MARKETPLACE_EMAIL_DOMAIN}`;
}

export function isDemoMarketplaceEmail(
  email: string | null | undefined,
  options?: { protectEmail?: string | null },
): boolean {
  const normalized = email?.trim().toLowerCase() ?? '';
  if (!normalized) return false;
  const protect = options?.protectEmail?.trim().toLowerCase();
  if (protect && normalized === protect) return false;
  return normalized.endsWith(`@${DEMO_MARKETPLACE_EMAIL_DOMAIN}`);
}
