import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEMO_BUYER_EMAILS,
  DEMO_OBSOLETE_FARMER_EMAILS,
  demoFarmerEmail,
  isDemoMarketplaceEmail,
} from './demo-marketplace-identities';

describe('demo marketplace identities', () => {
  it('matches seed emails and rejects ordinary accounts', () => {
    expect(isDemoMarketplaceEmail('farmer-fruits-1@agrobridge.local')).toBe(true);
    expect(isDemoMarketplaceEmail('buyer-1@agrobridge.local')).toBe(true);
    expect(isDemoMarketplaceEmail('Farmer-Fruits-1@AgroBridge.local')).toBe(true);
    expect(isDemoMarketplaceEmail('seller@gmail.com')).toBe(false);
    expect(isDemoMarketplaceEmail('admin@agrobridge.ge')).toBe(false);
    expect(isDemoMarketplaceEmail('')).toBe(false);
  });

  it('never selects the live ADMIN_EMAIL even if it uses the demo domain', () => {
    expect(
      isDemoMarketplaceEmail('admin@agrobridge.local', {
        protectEmail: 'admin@agrobridge.local',
      }),
    ).toBe(false);
    expect(
      isDemoMarketplaceEmail('farmer-fruits-1@agrobridge.local', {
        protectEmail: 'admin@agrobridge.local',
      }),
    ).toBe(true);
  });

  it('keeps the documented seed email pattern stable', () => {
    expect(demoFarmerEmail('fruits', 1)).toBe('farmer-fruits-1@agrobridge.local');
    expect(DEMO_BUYER_EMAILS).toEqual([
      'buyer-1@agrobridge.local',
      'buyer-2@agrobridge.local',
      'buyer-3@agrobridge.local',
      'buyer-4@agrobridge.local',
    ]);
    expect(DEMO_OBSOLETE_FARMER_EMAILS.every((email) => isDemoMarketplaceEmail(email))).toBe(
      true,
    );
  });

  it('covers every farmer/buyer email hardcoded in seed.ts', () => {
    const seed = readFileSync(join(__dirname, '../../prisma/seed.ts'), 'utf8');
    const emails = [...seed.matchAll(/'([a-z0-9.-]+@agrobridge\.local)'/g)].map(
      (match) => match[1],
    );
    expect(emails.length).toBeGreaterThan(10);
    for (const email of emails) {
      if (email.startsWith('admin@')) continue;
      expect(isDemoMarketplaceEmail(email)).toBe(true);
    }
  });
});
