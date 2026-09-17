import { readFileSync } from 'fs';
import { join } from 'path';
import { isPublicFarmProduct, toPublicFarmProfile } from '../../../web/src/lib/farm-profile';
import type { FarmDetail, ProductSummary } from '@agrobridge/shared';

const webRoot = join(__dirname, '../../../web/src');
const farmPage = readFileSync(join(webRoot, 'app/[locale]/dashboard/farm/page.tsx'), 'utf8');
const publicPage = readFileSync(join(webRoot, 'app/[locale]/farms/[id]/page.tsx'), 'utf8');
const profileView = readFileSync(join(webRoot, 'components/FarmProfileView.tsx'), 'utf8');
const ownerWorkspace = readFileSync(join(webRoot, 'components/FarmOwnerWorkspace.tsx'), 'utf8');
const farmForm = readFileSync(join(webRoot, 'components/FarmForm.tsx'), 'utf8');

const LOCALES = ['en', 'ru', 'ka', 'de', 'es', 'fr', 'it'] as const;

function messages(locale: string) {
  return JSON.parse(
    readFileSync(join(__dirname, '../../../web/messages', `${locale}.json`), 'utf8'),
  ) as { farm: Record<string, string> };
}

function product(overrides: Partial<ProductSummary>): ProductSummary {
  return {
    id: 'p1',
    ownerUserId: 'u1',
    title: 'Hazelnuts',
    description: null,
    category: 'nuts',
    variety: null,
    country: null,
    originPlace: null,
    unit: 'kg',
    minQuantity: null,
    maxQuantity: null,
    currentStock: null,
    monthlyProduction: null,
    maxAnnualProduction: null,
    seasonMonths: [],
    harvestStartAt: null,
    harvestEndAt: null,
    forecastQuantity: null,
    harvestStatus: 'in_season',
    preorderEnabled: false,
    attributes: {},
    packagingTypes: [],
    packagingWeights: [],
    palletSize: null,
    incoterms: [],
    carriers: [],
    customDelivery: null,
    nearestPort: null,
    deliveryAvailable: false,
    leadTimeDays: null,
    priceFrom: null,
    priceCurrency: null,
    priceNegotiable: false,
    priceDependsOnVolume: false,
    isPublished: true,
    moderationStatus: 'approved',
    moderationNote: null,
    images: [],
    videoCount: 0,
    certificateBadges: [],
    qualityScore: { score: 40, tier: 'basic', checklist: [] },
    opportunity: { kind: 'none' },
    owner: { id: 'u1', displayName: 'Owner' },
    sellerRating: { average: null, count: 0 },
    farm: null,
    ...overrides,
  } as ProductSummary;
}

function farm(overrides: Partial<FarmDetail> = {}): FarmDetail {
  return {
    id: 'f1',
    name: 'Kakheti Farm',
    region: 'kakheti',
    description: 'Hills',
    verificationStatus: 'unverified',
    verified: false,
    foundedYear: 2001,
    farmSizeHectares: 12,
    ownershipType: 'Family',
    exportMarkets: ['Germany'],
    history: 'Since 2001',
    owner: { id: 'u1', displayName: 'Owner' },
    productCount: 2,
    photos: [{ id: 'ph1', url: '/media/farm.jpg', sortOrder: 0, isPrimary: true }],
    createdAt: '2026-01-01T00:00:00.000Z',
    verificationNote: 'internal moderator note',
    verifiedAt: null,
    companyRegistrationNumber: '404123456',
    companyRegistryValid: true,
    documents: [
      {
        id: 'd1',
        farmId: 'f1',
        kind: 'idCard',
        title: 'ID',
        fileName: 'id.pdf',
        url: '/private/id.pdf',
        mimeType: 'application/pdf',
        reviewStatus: 'pending',
        reviewNote: null,
        reviewedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    products: [
      product({ id: 'live', isPublished: true, moderationStatus: 'approved' }),
      product({ id: 'draft', isPublished: false, moderationStatus: 'draft' }),
    ],
    ...overrides,
  };
}

describe('toPublicFarmProfile', () => {
  it('keeps only published approved products', () => {
    const visible = toPublicFarmProfile(farm());
    expect(visible.products.map((item) => item.id)).toEqual(['live']);
    expect(visible.productCount).toBe(1);
    expect(isPublicFarmProduct(product({ isPublished: false, moderationStatus: 'approved' }))).toBe(
      false,
    );
  });

  it('strips owner-only fields so the profile view cannot expose them', () => {
    const visible = toPublicFarmProfile(farm());
    expect(visible.documents).toBeUndefined();
    expect(visible.companyRegistrationNumber).toBeUndefined();
    expect(visible.companyRegistryValid).toBeUndefined();
    expect(visible.verificationNote).toBeNull();
    expect(visible.name).toBe('Kakheti Farm');
    expect(visible.photos).toHaveLength(1);
  });
});

describe('My Farm view/edit UX', () => {
  it('opens in view mode and keeps the edit form unmounted until Edit is clicked', () => {
    expect(ownerWorkspace).toContain('useState(false)');
    expect(ownerWorkspace).toContain('if (editing) return null');
    expect(farmPage).toContain('<FarmOwnerView>');
    expect(farmPage).toContain('<FarmProfileView');
    expect(farmPage).toContain('<FarmOwnerEditor>');
    expect(farmPage).toContain('<FarmForm');
    expect(farmPage.indexOf('<FarmOwnerView>')).toBeLessThan(farmPage.indexOf('<FarmOwnerEditor>'));
  });

  it('does not put editable inputs in the shared profile view', () => {
    expect(profileView).not.toContain('<input');
    expect(profileView).not.toContain('<textarea');
    expect(profileView).not.toContain('<select');
    expect(profileView).not.toContain('<FarmForm');
  });

  it('shows an Edit control to the owner', () => {
    expect(farmPage).toContain('<FarmEditButton>');
    expect(farmPage).toContain("t('editFarm')");
    expect(ownerWorkspace).toContain('onClick={startEdit}');
  });

  it('opens the existing edit form from Edit and returns to view on Cancel', () => {
    expect(farmPage).toContain('<FarmOwnerEditForm');
    expect(farmPage).toContain('<FarmPhotosManager');
    expect(farmPage).toContain('<FarmDocumentsManager');
    expect(farmPage).toContain('<FarmCancelButton>');
    expect(farmPage).toContain("t('cancelEdit')");
    expect(ownerWorkspace).toContain('onClick={cancelEdit}');
    expect(ownerWorkspace).toContain('setEditing(false)');
    expect(ownerWorkspace).toContain('onSaved={cancelEdit}');
  });

  it('returns to view after a successful save because the form refreshes the page', () => {
    expect(farmForm).toContain('onSaved?.()');
    expect(farmForm).toContain("router.replace('/dashboard/farm')");
    expect(farmForm).toContain('router.refresh()');
    expect(ownerWorkspace).toContain('onSaved={cancelEdit}');
    expect(ownerWorkspace).not.toContain('searchParams');
    expect(farmPage).not.toContain('searchParams');
  });

  it('keeps the producer verification panel on the owner view', () => {
    expect(farmPage).toContain(
      '{verification ? <ProducerVerificationPanel initial={verification} /> : null}',
    );
    expect(farmPage).toContain('{verificationUnavailable ? <VerificationLoadError /> : null}');
    expect(farmPage).toContain('<FarmOwnerView>');
  });

  it('creates a farm with the existing form when none exists yet', () => {
    expect(farmPage).toContain('mode="create"');
    expect(farmPage).toContain("t('createTitle')");
  });
});

describe('public farm profile sharing', () => {
  it('renders the public farm page through the shared profile view', () => {
    expect(publicPage).toContain('<FarmProfileView');
    expect(publicPage).not.toContain('<FarmForm');
    expect(publicPage).not.toContain('<FarmEditButton');
    expect(publicPage).not.toContain('ProducerVerificationPanel');
    expect(publicPage).not.toContain('FarmDocumentsManager');
  });

  it('does not render private owner fields in the shared profile view', () => {
    expect(profileView).not.toContain('documents');
    expect(profileView).not.toContain('verificationNote');
    expect(profileView).not.toContain('companyRegistrationNumber');
    expect(profileView).not.toContain('companyRegistryValid');
    expect(profileView).toContain('isPublicFarmProduct');
    expect(profileView).toContain('farm.photos');
    expect(profileView).toContain('farm.description');
    expect(profileView).toContain("t('aboutHeading')");
  });

  it('loads the owner view from the public farm endpoint so listings match visitors', () => {
    expect(farmPage).toContain('apiRequest<FarmDetail>(`/farms/${farm.id}`)');
    expect(farmPage).toContain('toPublicFarmProfile(farm)');
  });
});

describe('farm profile copy', () => {
  const required = ['editFarm', 'cancelEdit', 'aboutHeading', 'size', 'hectaresValue'] as const;

  it.each(LOCALES)('%s translates the view/edit chrome', (locale) => {
    const farmCopy = messages(locale).farm;
    for (const key of required) {
      expect(typeof farmCopy[key]).toBe('string');
      expect(farmCopy[key].trim().length).toBeGreaterThan(0);
    }
    expect(farmCopy.hectaresValue).toContain('{count}');
  });

  it('keeps every locale on its own Edit label', () => {
    const labels = LOCALES.map((locale) => messages(locale).farm.editFarm);
    expect(new Set(labels).size).toBe(LOCALES.length);
  });
});
