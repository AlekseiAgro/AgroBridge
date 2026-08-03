import {
  attributeFieldsForCategory,
  type ProductImageKind,
} from '@agrobridge/shared';
import {
  CertificateType,
  DocumentReviewStatus,
  Prisma,
  ProductImageKind as PrismaImageKind,
  type PrismaClient,
} from '@prisma/client';
import { copyFile, mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

export type DemoRichness = 'sparse' | 'light' | 'medium' | 'full';

export function richnessFor(globalIndex: number): DemoRichness {
  return (['sparse', 'light', 'medium', 'full'] as const)[globalIndex % 4];
}

const EXPORT_MARKET_SETS = [
  ['Germany', 'Netherlands'],
  ['Germany', 'Poland'],
  ['Poland', 'Czechia'],
  ['France', 'Italy'],
  ['UAE', 'Kazakhstan'],
  ['Germany', 'UK'],
  ['Italy', 'Spain'],
] as const;

const PRICE_FROM: Record<string, number> = {
  fruits: 1.85,
  berries: 6.4,
  vegetables: 0.95,
  nuts: 8.9,
  wine: 11.5,
  dairy: 4.2,
  honey: 14.5,
  mineralWater: 0.55,
  spices: 9.8,
  tea: 7.2,
  bayLeaf: 5.4,
  essentialOils: 48,
  organic: 2.4,
  other: 3.1,
};

const VARIETY_BY_TITLE: Record<string, string> = {
  'Fresh Kakheti peaches': 'Freestone peach',
  'Guria mandarins': 'Unshiu',
  'Kartli dessert apples': 'Idared',
  'Kakheti persimmons': 'Fuyu',
  'Greenhouse tomatoes': 'Cluster tomato',
  'Imereti potatoes': 'Agria',
  'Sweet peppers mix': 'California Wonder mix',
  'Fresh cucumbers': 'Field cucumber',
  'Georgian hazelnuts (shelled)': 'Anakliuri',
  'In-shell walnuts': 'Chandler',
  'Roasted almond kernels': 'Nonpareil',
  'Saperavi qvevri 2024': 'Saperavi',
  'Rkatsiteli white wine': 'Rkatsiteli',
  'Tsitska-Tsolikouri blend': 'Tsitska-Tsolikouri',
  'Dry Saperavi rosé': 'Saperavi rosé',
  'Guda sheep cheese': 'Guda',
  'Farm matsoni': 'Matsoni',
  'Fresh sulguni': 'Sulguni',
  'Racha mountain honey': 'Multifloral',
  'Chestnut blossom honey': 'Chestnut',
  'Acacia honey': 'Acacia',
  'Highland wildflower honey': 'Wildflower',
  'Adjara blueberries': 'Duke',
  'Fresh raspberries': 'Polka',
  'Guria strawberries': 'Clery',
  'Natural sparkling mineral water': 'Borjomi-style',
  'Still mineral water': 'Sairme-style',
  'Dried Georgian blue fenugreek': 'Utskho suneli',
  'Dried thyme and savory mix': 'Mountain herbs',
  'Dried adjika spice blend': 'Adjika dry',
  'Guria black tea': 'Orthodox leaf',
  'Georgian green tea': 'Sencha-style',
  'Dried bay leaves': 'Laurus nobilis',
  'Premium bay leaf grade A': 'Grade A whole leaf',
  'Lavender essential oil': 'Lavandula angustifolia',
  'Mandarin peel essential oil': 'Citrus reticulata',
  'Organic mixed vegetables': 'Seasonal mix',
  'Organic dessert apples': 'Golden Delicious',
  'Organic wildflower honey': 'Organic wildflower',
};

function sampleAttributes(
  category: string,
  fillRatio: number,
  seed: number,
): Record<string, unknown> {
  const fields = attributeFieldsForCategory(category);
  const count = Math.max(0, Math.ceil(fields.length * fillRatio));
  const attrs: Record<string, unknown> = {};
  for (let i = 0; i < count; i += 1) {
    const field = fields[i]!;
    if (field.type === 'boolean') {
      attrs[field.key] = (seed + i) % 2 === 0;
    } else if (field.type === 'number') {
      attrs[field.key] = 8 + ((seed + i * 3) % 18);
    } else if (field.type === 'select' && field.options?.length) {
      attrs[field.key] = field.options[(seed + i) % field.options.length];
    } else {
      attrs[field.key] = `Demo ${field.key}`;
    }
  }
  return attrs;
}

export async function enrichDemoFarm(params: {
  prisma: PrismaClient;
  farmId: string;
  richness: DemoRichness;
  globalIndex: number;
  region: string | null;
  farmName: string;
}) {
  const { prisma, farmId, richness, globalIndex, region, farmName } = params;
  if (richness === 'sparse') {
    await prisma.farm.update({
      where: { id: farmId },
      data: {
        foundedYear: null,
        farmSizeHectares: null,
        ownershipType: null,
        exportMarkets: [],
        history: null,
      },
    });
    return;
  }

  const markets =
    richness === 'full'
      ? [...EXPORT_MARKET_SETS[globalIndex % EXPORT_MARKET_SETS.length]]
      : richness === 'medium'
        ? [EXPORT_MARKET_SETS[globalIndex % EXPORT_MARKET_SETS.length][0]]
        : [];

  await prisma.farm.update({
    where: { id: farmId },
    data: {
      foundedYear: 1992 + (globalIndex % 28),
      farmSizeHectares:
        richness === 'light' ? null : Number((4 + (globalIndex % 37) * 1.7).toFixed(1)),
      ownershipType: globalIndex % 3 === 0 ? 'cooperative' : globalIndex % 3 === 1 ? 'family' : 'llc',
      exportMarkets: markets,
      history:
        richness === 'full'
          ? `${farmName} has supplied ${region ?? 'Georgia'} buyers for more than a decade, with gradual expansion into export packing.`
          : richness === 'medium'
            ? `${farmName} focuses on consistent seasonal supply from ${region ?? 'Georgia'}.`
            : null,
    },
  });
}

export async function buildEnrichedProductData(params: {
  category: string;
  title: string;
  region: string | null;
  richness: DemoRichness;
  globalIndex: number;
  quantity: { minQuantity: number; maxQuantity: number };
}) {
  const { category, title, region, richness, globalIndex, quantity } = params;
  const variety =
    richness === 'sparse' ? null : (VARIETY_BY_TITLE[title] ?? title.split(' ').slice(-1)[0] ?? title);
  const originPlace =
    richness === 'sparse'
      ? null
      : region
        ? `${region.charAt(0).toUpperCase()}${region.slice(1)} district`
        : 'Georgia';

  const basePrice = PRICE_FROM[category] ?? 3;
  const priceFrom =
    richness === 'sparse'
      ? null
      : Number((basePrice * (0.85 + (globalIndex % 5) * 0.08)).toFixed(2));

  const fillRatio =
    richness === 'full' ? 1 : richness === 'medium' ? 0.7 : richness === 'light' ? 0.4 : 0;

  const stockFactor =
    richness === 'full' ? 0.9 : richness === 'medium' ? 0.55 : richness === 'light' ? 0.35 : 0.15;

  return {
    variety,
    country: 'Georgia',
    originPlace,
    attributes: sampleAttributes(category, fillRatio, globalIndex) as Prisma.InputJsonValue,
    packagingTypes:
      richness === 'sparse'
        ? []
        : richness === 'light'
          ? ['carton']
          : richness === 'medium'
            ? ['carton', 'pallet']
            : ['carton', 'woodenBox', 'pallet'],
    packagingWeights:
      richness === 'sparse'
        ? []
        : richness === 'light'
          ? ['5 kg']
          : richness === 'medium'
            ? ['5 kg', '10 kg']
            : ['1 kg', '5 kg', '10 kg'],
    palletSize: richness === 'full' ? 'EUR pallet 80×120' : null,
    incoterms: richness === 'full' ? ['EXW', 'FOB', 'CIF'] : [],
    carriers: richness === 'full' ? ['DHL', 'other'] : [],
    nearestPort: richness === 'full' ? (globalIndex % 2 === 0 ? 'Poti' : 'Batumi') : null,
    deliveryAvailable: richness === 'full',
    leadTimeDays: richness === 'full' ? 7 + (globalIndex % 10) : null,
    customDelivery: richness === 'full' ? 'Reefer truck to Poti / Batumi on request' : null,
    priceFrom,
    priceCurrency: priceFrom != null ? 'EUR' : null,
    priceNegotiable: richness === 'medium' || richness === 'full',
    priceDependsOnVolume: richness === 'full',
    currentStock:
      richness === 'sparse'
        ? null
        : Number((quantity.maxQuantity * stockFactor).toFixed(2)),
    monthlyProduction:
      richness === 'full' || richness === 'medium'
        ? Number((quantity.maxQuantity * (richness === 'full' ? 1.4 : 1.1)).toFixed(2))
        : null,
    maxAnnualProduction:
      richness === 'full' || richness === 'medium'
        ? Number((quantity.maxQuantity * (richness === 'full' ? 10 : 6)).toFixed(2))
        : null,
  };
}

export function harvestPlanFor(richness: DemoRichness, globalIndex: number) {
  const plans = {
    sparse: {
      status: (['available', 'soldOut'] as const)[globalIndex % 2],
      preorder: false,
      startOffset: -5,
      endOffset: 20,
    },
    light: {
      status: (['growing', 'available', 'limited'] as const)[globalIndex % 3],
      preorder: globalIndex % 3 !== 1,
      startOffset: globalIndex % 2 === 0 ? 10 : -3,
      endOffset: 28,
    },
    medium: {
      status: (['growing', 'limited', 'available'] as const)[globalIndex % 3],
      preorder: true,
      startOffset: 18,
      endOffset: 40,
    },
    full: {
      status: (['limited', 'growing', 'available'] as const)[globalIndex % 3],
      preorder: true,
      startOffset: 21,
      endOffset: 45,
    },
  };
  return plans[richness];
}

export async function seedProductMedia(params: {
  prisma: PrismaClient;
  productId: string;
  category: string;
  uploadsDir: string;
  categoryImageDir: string;
  richness: DemoRichness;
  adminId: string;
}) {
  const {
    prisma,
    productId,
    category,
    uploadsDir,
    categoryImageDir,
    richness,
    adminId,
  } = params;
  const source = join(categoryImageDir, `${category}.jpg`);

  await prisma.productImage.deleteMany({ where: { productId } });
  await prisma.productVideo.deleteMany({ where: { productId } });
  await prisma.productCertificate.deleteMany({ where: { productId } });

  if (richness === 'sparse') {
    return;
  }

  const kindsByRichness: Record<DemoRichness, ProductImageKind[]> = {
    sparse: [],
    light: ['overview', 'closeup'],
    medium: ['overview', 'closeup', 'packaging'],
    full: ['overview', 'closeup', 'packaging', 'harvest', 'field'],
  };

  const kinds = kindsByRichness[richness];
  for (const [sortOrder, kind] of kinds.entries()) {
    const key = `products/${productId}/seed-${category}-${kind}-${sortOrder}.jpg`;
    const absolute = join(uploadsDir, key);
    await mkdir(dirname(absolute), { recursive: true });
    try {
      await copyFile(source, absolute);
    } catch {
      continue;
    }
    await prisma.productImage.create({
      data: {
        productId,
        url: `/api/uploads/${key}`,
        key,
        sortOrder,
        isPrimary: sortOrder === 0,
        kind: kind as PrismaImageKind,
      },
    });
  }

  if (richness === 'full') {
    const videoKey = `products/${productId}/seed-overview.mp4`;
    const videoPath = join(uploadsDir, videoKey);
    await mkdir(dirname(videoPath), { recursive: true });
    await writeFile(videoPath, Buffer.from('demo-video-placeholder'), 'utf8');
    await prisma.productVideo.create({
      data: {
        productId,
        url: `/api/uploads/${videoKey}`,
        key: videoKey,
        fileName: 'farm-overview.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 22,
        durationSeconds: 45,
      },
    });
  }

  if (richness === 'light' || richness === 'medium') {
    return;
  }

  const certSpecs = [
    { type: CertificateType.globalGap, title: 'GLOBALG.A.P. certificate', approved: true },
    { type: CertificateType.haccp, title: 'HACCP plan', approved: true },
    { type: CertificateType.organic, title: 'Organic certificate', approved: false },
  ];

  for (const cert of certSpecs) {
    const key = `products/${productId}/certificates/${cert.type}.txt`;
    const absolute = join(uploadsDir, key);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, `Demo ${cert.title} for product ${productId}\n`, 'utf8');
    await prisma.productCertificate.create({
      data: {
        productId,
        type: cert.type,
        title: cert.title,
        fileName: `${cert.type}.txt`,
        url: `/api/uploads/${key}`,
        key,
        mimeType: 'application/pdf',
        sizeBytes: 64,
        reviewStatus: cert.approved
          ? DocumentReviewStatus.approved
          : DocumentReviewStatus.pending,
        reviewedAt: cert.approved ? new Date() : null,
        reviewedById: cert.approved ? adminId : null,
      },
    });
  }
}
