import { readFileSync } from 'fs';
import { join } from 'path';
import { isPublicFarmProduct, toPublicFarmProfile } from '../../../web/src/lib/farm-profile';
import {
  verificationPresentation,
  type VerificationPresentation,
} from '../../../web/src/lib/verification-presentation';
import type { FarmDetail, ProducerVerificationStatus, ProductSummary } from '@agrobridge/shared';

const webRoot = join(__dirname, '../../../web/src');
const farmPage = readFileSync(join(webRoot, 'app/[locale]/dashboard/farm/page.tsx'), 'utf8');
const publicPage = readFileSync(join(webRoot, 'app/[locale]/farms/[id]/page.tsx'), 'utf8');
const profileView = readFileSync(join(webRoot, 'components/FarmProfileView.tsx'), 'utf8');
const ownerWorkspace = readFileSync(join(webRoot, 'components/FarmOwnerWorkspace.tsx'), 'utf8');
const farmForm = readFileSync(join(webRoot, 'components/FarmForm.tsx'), 'utf8');
const photosManager = readFileSync(join(webRoot, 'components/FarmPhotosManager.tsx'), 'utf8');
const documentsManager = readFileSync(join(webRoot, 'components/FarmDocumentsManager.tsx'), 'utf8');
const coverPhotos = readFileSync(join(webRoot, 'components/FarmCoverPhotos.tsx'), 'utf8');
const verificationSection = readFileSync(
  join(webRoot, 'components/ProducerVerificationSection.tsx'),
  'utf8',
);

const LOCALES = ['en', 'ru', 'ka', 'de', 'es', 'fr', 'it'] as const;

function messages(locale: string) {
  return JSON.parse(
    readFileSync(join(__dirname, '../../../web/messages', `${locale}.json`), 'utf8'),
  ) as {
    farm: Record<string, string> & {
      photos: Record<string, string>;
      documents: Record<string, string>;
      verification: Record<string, string>;
    };
  };
}

function verificationStatus(
  overrides: Partial<ProducerVerificationStatus> = {},
): ProducerVerificationStatus {
  return {
    verified: false,
    farmVerificationStatus: 'unverified',
    verificationReasonCode: null,
    moderatorComment: null,
    sellerType: null,
    emailVerified: true,
    phone: null,
    phoneVerified: false,
    companyRegistrationNumber: null,
    companyRegistryName: null,
    companyRegistryValid: null,
    hasApprovedIdDocument: false,
    hasPendingIdDocument: false,
    hasPendingVerificationDocument: false,
    sellerTypeLocked: false,
    path: 'unknown',
    steps: { email: 'done', phone: 'todo', identity: 'todo' },
    ...overrides,
    steps: {
      email: 'done',
      phone: 'todo',
      identity: 'todo',
      ...overrides.steps,
    },
  };
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

  it('hides published products that still use an internal draft title', () => {
    const visible = toPublicFarmProfile(
      farm({
        products: [
          product({ id: 'live', title: 'Hazelnuts' }),
          product({ id: 'draft-ru', title: 'Новый товар' }),
          product({ id: 'empty', title: '' }),
        ],
      }),
    );
    expect(visible.products.map((item) => item.id)).toEqual(['live']);
    expect(isPublicFarmProduct(product({ title: 'Новый товар' }))).toBe(false);
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
    expect(farmPage).toContain("t('cancelHint')");
    expect(ownerWorkspace).toContain('onClick={cancelEdit}');
    expect(ownerWorkspace).toContain('setEditing(false)');
    expect(ownerWorkspace).toContain('onSaved={cancelEdit}');
    expect(farmPage.indexOf('<FarmOwnerEditForm')).toBeLessThan(
      farmPage.indexOf('<FarmPhotosManager'),
    );
    expect(farmPage.indexOf('<FarmPhotosManager')).toBeLessThan(
      farmPage.indexOf('<FarmDocumentsManager'),
    );
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
      '{verification ? <ProducerVerificationSection initial={verification} /> : null}',
    );
    expect(farmPage).toContain('{verificationUnavailable ? <VerificationLoadError /> : null}');
    expect(farmPage).toContain('<FarmOwnerView>');
    expect(verificationSection).toContain('<ProducerVerificationPanel initial={initial} />');
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
  const required = [
    'editFarm',
    'cancelEdit',
    'cancelHint',
    'formSaveHint',
    'aboutHeading',
    'size',
    'hectaresValue',
    'saveSubmit',
  ] as const;

  it.each(LOCALES)('%s translates the view/edit chrome', (locale) => {
    const farmCopy = messages(locale).farm;
    for (const key of required) {
      expect(typeof farmCopy[key]).toBe('string');
      expect(farmCopy[key].trim().length).toBeGreaterThan(0);
    }
    expect(farmCopy.hectaresValue).toContain('{count}');
    expect(farmCopy.photos.savedImmediately.trim().length).toBeGreaterThan(0);
    expect(farmCopy.photos.openPhoto).toContain('{index}');
    expect(farmCopy.photos.openPhoto).toContain('{name}');
    expect(farmCopy.photos.viewerTitle.trim().length).toBeGreaterThan(0);
    expect(farmCopy.photos.closeViewer.trim().length).toBeGreaterThan(0);
    expect(farmCopy.documents.savedImmediately.trim().length).toBeGreaterThan(0);
    for (const key of [
      'promptTitle',
      'promptBody',
      'start',
      'attentionTitle',
      'attentionBody',
      'continue',
    ] as const) {
      expect(farmCopy.verification[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps every locale on its own Edit label', () => {
    const labels = LOCALES.map((locale) => messages(locale).farm.editFarm);
    expect(new Set(labels).size).toBe(LOCALES.length);
  });
});

describe('verification presentation', () => {
  const cases: Array<[string, ProducerVerificationStatus, VerificationPresentation]> = [
    [
      'hides the workflow when the producer is already approved',
      verificationStatus({
        verified: true,
        farmVerificationStatus: 'approved',
        steps: { email: 'done', phone: 'done', identity: 'done' },
      }),
      'hidden',
    ],
    ['shows a compact prompt when verification has not started', verificationStatus(), 'prompt'],
    [
      'does not treat account email confirmation as having started verification',
      verificationStatus({
        emailVerified: true,
        steps: { email: 'done', phone: 'todo', identity: 'todo' },
      }),
      'prompt',
    ],
    [
      'shows the workflow once a seller type is chosen',
      verificationStatus({ sellerType: 'privateFarmer', path: 'privateFarmer' }),
      'workflow',
    ],
    [
      'shows the workflow while a document is pending review',
      verificationStatus({
        farmVerificationStatus: 'pending',
        hasPendingVerificationDocument: true,
        steps: { email: 'done', phone: 'done', identity: 'pending_review' },
      }),
      'workflow',
    ],
    [
      'shows attention when verification was rejected',
      verificationStatus({
        farmVerificationStatus: 'rejected',
        verificationReasonCode: 'documentRejected',
        steps: { email: 'done', phone: 'done', identity: 'rejected' },
      }),
      'attention',
    ],
  ];

  it.each(cases)('%s', (_title, status, expected) => {
    expect(verificationPresentation(status)).toBe(expected);
  });

  it('hides the detailed checklist for approved producers', () => {
    expect(verificationSection).toContain("presentation === 'hidden'");
    expect(verificationSection).toContain('return null');
    expect(verificationSection).not.toContain('verification-steps');
  });

  it('starts unverified producers on a compact reminder', () => {
    expect(verificationSection).toContain("t('promptTitle')");
    expect(verificationSection).toContain("t('start')");
    expect(verificationSection).toContain('setExpanded(true)');
  });

  it('opens the existing workflow in progress and after rejection', () => {
    expect(verificationSection).toContain(
      "presentation === 'workflow' || presentation === 'attention'",
    );
    expect(verificationSection).toContain("t('attentionTitle')");
    expect(verificationSection).toContain('t(`reason.${initial.verificationReasonCode}`)');
    expect(verificationSection).toContain('<ProducerVerificationPanel initial={initial} />');
  });
});

describe('edit form save placement', () => {
  it('puts the primary Save action at the end of the profile form', () => {
    expect(farmForm).toContain('className="farm-form__actions"');
    expect(farmForm).toContain("t('formSaveHint')");
    expect(farmForm).toContain("t('saveSubmit')");
    expect(farmForm.indexOf('name="history"')).toBeLessThan(farmForm.indexOf('farm-form__actions'));
    expect(farmForm.indexOf('farm-form__actions')).toBeLessThan(farmForm.indexOf('type="submit"'));
    expect(farmForm.split('type="submit"').length - 1).toBe(1);
  });

  it('tells the owner that photo and document uploads save immediately', () => {
    expect(photosManager).toContain("t('photos.savedImmediately')");
    expect(documentsManager).toContain("t('documents.savedImmediately')");
  });
});

describe('compact farm header', () => {
  it('uses a compact cover instead of the product hero gallery', () => {
    expect(profileView).toContain('<FarmCoverPhotos');
    expect(profileView).toContain('farm-profile__lede');
    expect(profileView).not.toContain('product-gallery');
    expect(profileView).not.toContain('product-gallery__image--primary');
  });

  it('places the mobile farm-header override after the desktop declaration', () => {
    const css = readFileSync(join(webRoot, 'app/globals.css'), 'utf8');
    const desktopHeader = css.indexOf(
      [
        '.farm-profile__header--with-cover {',
        '  display: grid;',
        '  grid-template-columns: minmax(7.5rem, 11.5rem) minmax(0, 1fr);',
      ].join('\n'),
    );
    const desktopCover = css.indexOf(
      [
        '.farm-profile__cover-image {',
        '  display: block;',
        '  width: 100%;',
        '  max-height: 10.5rem;',
        '  aspect-ratio: 4 / 3;',
      ].join('\n'),
    );
    const mobileHeader = css.indexOf(
      '.farm-profile__header--with-cover {\n    grid-template-columns: 1fr;',
    );
    const mobileCover = css.indexOf(
      '.farm-profile__cover-image {\n    max-height: 8.5rem;\n    aspect-ratio: 16 / 9;',
    );

    expect(desktopHeader).toBeGreaterThan(-1);
    expect(desktopCover).toBeGreaterThan(-1);
    expect(mobileHeader).toBeGreaterThan(desktopHeader);
    expect(mobileCover).toBeGreaterThan(desktopCover);

    const mediaBeforeMobileHeader = css.lastIndexOf('@media (max-width: 640px)', mobileHeader);
    expect(mediaBeforeMobileHeader).toBeGreaterThan(desktopHeader);
  });

  it('opens extra farm photos in an accessible native dialog', () => {
    expect(profileView).toContain('<FarmCoverPhotos farmName={farm.name} cover={cover} extraPhotos={extraPhotos} />');
    expect(coverPhotos).toContain('dialogRef.current?.showModal()');
    expect(coverPhotos).toContain('className="farm-profile__cover-thumb-button"');
    expect(coverPhotos).toContain("t('openPhoto', { name: farmName, index: index + 2 })");
    expect(coverPhotos).toContain("t('closeViewer')");
    expect(coverPhotos).toContain('aria-labelledby={titleId}');
    expect(coverPhotos).toContain('toPublicMediaUrl(photo.url)');
    expect(coverPhotos).not.toContain('farm.documents');
  });
});
