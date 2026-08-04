import {
  CurrencyCode,
  DocumentReviewStatus,
  LocaleCode,
  ModerationStatus,
  PrismaClient,
  PurchaseQuoteStatus,
  PurchaseRequestStatus,
  RfqStatus,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { PRODUCT_CATEGORIES } from '@agrobridge/shared';
import {
  buildEnrichedProductData,
  enrichDemoFarm,
  harvestPlanFor,
  richnessFor,
  seedProductMedia,
} from './seed-enrichment';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'DemoPass123';
const UPLOADS_DIR = resolve(
  process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), 'uploads'),
);
const CATEGORY_IMAGE_DIR = resolve(
  process.cwd(),
  '../web/public/images/categories',
);

type DemoProduct = {
  title: string;
  description: string;
  unit: string;
  minQuantity?: number;
  maxQuantity?: number;
  seasonMonths?: number[];
  harvestStatus?: 'growing' | 'available' | 'limited' | 'soldOut';
  forecastQuantity?: number;
  preorderEnabled?: boolean;
  harvestOffsetDays?: { start: number; end: number };
};

function quantityForUnit(unit: string, index: number): { minQuantity: number; maxQuantity: number } {
  const variance = 1 + (index % 3) * 0.35;
  switch (unit) {
    case 'ton':
      return { minQuantity: 1, maxQuantity: Math.round(12 * variance) };
    case 'box':
      return { minQuantity: 10, maxQuantity: Math.round(180 * variance) };
    case 'bottle':
      return { minQuantity: 12, maxQuantity: Math.round(600 * variance) };
    case 'liter':
      return { minQuantity: 20, maxQuantity: Math.round(400 * variance) };
    case 'piece':
      return { minQuantity: 20, maxQuantity: Math.round(500 * variance) };
    case 'kg':
    default:
      return { minQuantity: 50, maxQuantity: Math.round(1500 * variance) };
  }
}

type DemoFarmer = {
  email: string;
  displayName: string;
  locale: LocaleCode;
  farmName: string;
  region: string;
  farmDescription: string;
  product: DemoProduct;
};

type DemoBuyer = {
  email: string;
  displayName: string;
  locale: LocaleCode;
};

const BUYERS: DemoBuyer[] = [
  {
    email: 'buyer-1@agrobridge.local',
    displayName: 'Elena Rossi',
    locale: LocaleCode.it,
  },
  {
    email: 'buyer-2@agrobridge.local',
    displayName: 'Marcus Weber',
    locale: LocaleCode.de,
  },
  {
    email: 'buyer-3@agrobridge.local',
    displayName: 'Sophie Martin',
    locale: LocaleCode.fr,
  },
  {
    email: 'buyer-4@agrobridge.local',
    displayName: 'Anna Petrova',
    locale: LocaleCode.ru,
  },
];

/** About 3–4 demo farmers (with farm + product) per product category. */
const FARMERS_BY_CATEGORY: Record<string, DemoFarmer[]> = {
  fruits: [
    {
      email: 'farmer-fruits-1@agrobridge.local',
      displayName: 'Nino Beridze',
      locale: LocaleCode.ka,
      farmName: 'Kakheti Orchard Co-op',
      region: 'kakheti',
      farmDescription: 'Family orchards with peaches, apples, and plums.',
      product: {
        title: 'Fresh Kakheti peaches',
        description: 'Seasonal freestone peaches, hand-picked for export.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-fruits-2@agrobridge.local',
      displayName: 'Giorgi Tsereteli',
      locale: LocaleCode.en,
      farmName: 'Guria Citrus Grove',
      region: 'guria',
      farmDescription: 'Coastal citrus and subtropical fruit.',
      product: {
        title: 'Guria mandarins',
        description: 'Sweet seedless mandarins from Guria hillside groves.',
        unit: 'box',
      },
    },
    {
      email: 'farmer-fruits-3@agrobridge.local',
      displayName: 'Mariam Kapanadze',
      locale: LocaleCode.ka,
      farmName: 'Shida Kartli Apples',
      region: 'shidaKartli',
      farmDescription: 'Cold-climate apple varieties for fresh and processing markets.',
      product: {
        title: 'Kartli dessert apples',
        description: 'Crisp late-season apples, sorted for retail packing.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-fruits-4@agrobridge.local',
      displayName: 'Levan Maisuradze',
      locale: LocaleCode.ru,
      farmName: 'Kakheti Persimmon Grove',
      region: 'kakheti',
      farmDescription: 'Late-season persimmons and table fruit for export.',
      product: {
        title: 'Kakheti persimmons',
        description: 'Sweet persimmons, sorted for fresh packing and drying.',
        unit: 'kg',
      },
    },
  ],
  vegetables: [
    {
      email: 'farmer-vegetables-1@agrobridge.local',
      displayName: 'Tamar Gelashvili',
      locale: LocaleCode.ka,
      farmName: 'Kvemo Kartli Greens',
      region: 'kvemoKartli',
      farmDescription: 'Open-field vegetables for regional buyers.',
      product: {
        title: 'Greenhouse tomatoes',
        description: 'Cluster tomatoes with firm flesh for wholesale.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-vegetables-2@agrobridge.local',
      displayName: 'Irakli Chkheidze',
      locale: LocaleCode.en,
      farmName: 'Imereti Root Crops',
      region: 'imereti',
      farmDescription: 'Potatoes, carrots, and seasonal root vegetables.',
      product: {
        title: 'Imereti potatoes',
        description: 'Washed table potatoes, graded by size.',
        unit: 'ton',
      },
    },
    {
      email: 'farmer-vegetables-3@agrobridge.local',
      displayName: 'Salome Javakhishvili',
      locale: LocaleCode.ka,
      farmName: 'Samegrelo Pepper Fields',
      region: 'samegreloZemoSvaneti',
      farmDescription: 'Sweet and hot peppers for fresh and processing use.',
      product: {
        title: 'Sweet peppers mix',
        description: 'Color mix of sweet peppers, harvest-to-order packing.',
        unit: 'box',
      },
    },
    {
      email: 'farmer-vegetables-4@agrobridge.local',
      displayName: 'David Lobzhanidze',
      locale: LocaleCode.ru,
      farmName: 'Mtskheta Valley Veg',
      region: 'mtskhetaMtianeti',
      farmDescription: 'Leafy greens and cucumbers near Tbilisi logistics.',
      product: {
        title: 'Fresh cucumbers',
        description: 'Crisp field cucumbers for HORECA and retail.',
        unit: 'kg',
      },
    },
  ],
  nuts: [
    {
      email: 'farmer-nuts-1@agrobridge.local',
      displayName: 'Ketevan Abashidze',
      locale: LocaleCode.ka,
      farmName: 'Samegrelo Hazelnut Grove',
      region: 'samegreloZemoSvaneti',
      farmDescription: 'Shelled and in-shell hazelnuts for export.',
      product: {
        title: 'Georgian hazelnuts (shelled)',
        description: 'Dried shelled hazelnuts, export grade.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-nuts-2@agrobridge.local',
      displayName: 'Zurab Kiknadze',
      locale: LocaleCode.en,
      farmName: 'Guria Walnut Estate',
      region: 'guria',
      farmDescription: 'Walnuts and mixed nuts from western Georgia.',
      product: {
        title: 'In-shell walnuts',
        description: 'Air-dried walnuts, sorted for wholesale buyers.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-nuts-3@agrobridge.local',
      displayName: 'Natia Shengelia',
      locale: LocaleCode.ka,
      farmName: 'Imereti Almond Ridge',
      region: 'imereti',
      farmDescription: 'Small-batch almonds and hazelnut blends.',
      product: {
        title: 'Roasted almond kernels',
        description: 'Lightly roasted almond kernels for confectionery.',
        unit: 'kg',
      },
    },
  ],
  wine: [
    {
      email: 'farmer-wine-1@agrobridge.local',
      displayName: 'Vakhtang Alavidze',
      locale: LocaleCode.ka,
      farmName: 'Kakheti Qvevri Cellar',
      region: 'kakheti',
      farmDescription: 'Traditional qvevri wines and estate Saperavi.',
      product: {
        title: 'Saperavi qvevri 2024',
        description: 'Amber-macerated Saperavi, bottled for export.',
        unit: 'bottle',
      },
    },
    {
      email: 'farmer-wine-2@agrobridge.local',
      displayName: 'Elene Ninidze',
      locale: LocaleCode.en,
      farmName: 'Kartli Vineyards',
      region: 'shidaKartli',
      farmDescription: 'Cooler-climate white and sparkling base wines.',
      product: {
        title: 'Rkatsiteli white wine',
        description: 'Crisp Rkatsiteli for restaurants and importers.',
        unit: 'bottle',
      },
    },
    {
      email: 'farmer-wine-3@agrobridge.local',
      displayName: 'Beso Kvirikashvili',
      locale: LocaleCode.ru,
      farmName: 'Imereti Natural Wines',
      region: 'imereti',
      farmDescription: 'Low-intervention wines from western Georgia.',
      product: {
        title: 'Tsitska-Tsolikouri blend',
        description: 'Fresh western Georgian white blend, screw-cap ready.',
        unit: 'bottle',
      },
    },
    {
      email: 'farmer-wine-4@agrobridge.local',
      displayName: 'Ana Bakradze',
      locale: LocaleCode.ka,
      farmName: 'Kakheti Rosé House',
      region: 'kakheti',
      farmDescription: 'Modern rosé and light reds for retail chains.',
      product: {
        title: 'Dry Saperavi rosé',
        description: 'Pale dry rosé from estate Saperavi grapes.',
        unit: 'bottle',
      },
    },
  ],
  dairy: [
    {
      email: 'farmer-dairy-1@agrobridge.local',
      displayName: 'Lika Tabidze',
      locale: LocaleCode.ka,
      farmName: 'Tusheti Alpine Dairy',
      region: 'kakheti',
      farmDescription: 'Mountain sheep and cow cheeses from alpine pastures.',
      product: {
        title: 'Guda sheep cheese',
        description: 'Traditional salted guda cheese, vacuum packed.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-dairy-2@agrobridge.local',
      displayName: 'Mikheil Baratashvili',
      locale: LocaleCode.en,
      farmName: 'Imereti Farm Dairy',
      region: 'imereti',
      farmDescription: 'Fresh milk, matsoni, and soft cheeses.',
      product: {
        title: 'Farm matsoni',
        description: 'Traditional cultured matsoni in retail jars.',
        unit: 'liter',
      },
    },
    {
      email: 'farmer-dairy-3@agrobridge.local',
      displayName: 'Sopiko Megrelishvili',
      locale: LocaleCode.ka,
      farmName: 'Samegrelo Sulguni Works',
      region: 'samegreloZemoSvaneti',
      farmDescription: 'Sulguni and smoked cheeses for HORECA.',
      product: {
        title: 'Fresh sulguni',
        description: 'Daily fresh sulguni cheese, chilled logistics.',
        unit: 'kg',
      },
    },
  ],
  honey: [
    {
      email: 'farmer-honey-1@agrobridge.local',
      displayName: 'Archil Tsiklauri',
      locale: LocaleCode.ka,
      farmName: 'Racha Mountain Apiary',
      region: 'rachaLechkhumiKvemoSvaneti',
      farmDescription: 'High-altitude floral honey from mountain meadows.',
      product: {
        title: 'Racha mountain honey',
        description: 'Raw multifloral honey from Racha pastures.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-honey-2@agrobridge.local',
      displayName: 'Tea Gogoladze',
      locale: LocaleCode.en,
      farmName: 'Adjara Chestnut Honey',
      region: 'adjara',
      farmDescription: 'Chestnut blossom honey from Adjara forests.',
      product: {
        title: 'Chestnut blossom honey',
        description: 'Dark aromatic chestnut honey, glass jars.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-honey-3@agrobridge.local',
      displayName: 'Pavel Orbeliani',
      locale: LocaleCode.ru,
      farmName: 'Kakheti Acacia Hives',
      region: 'kakheti',
      farmDescription: 'Light acacia honey for export retail.',
      product: {
        title: 'Acacia honey',
        description: 'Mild light acacia honey, filtered and bottled.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-honey-4@agrobridge.local',
      displayName: 'Medea Chanturia',
      locale: LocaleCode.ka,
      farmName: 'Samtskhe Wildflower Apiary',
      region: 'samtskheJavakheti',
      farmDescription: 'Wildflower honey from highland plateaus.',
      product: {
        title: 'Highland wildflower honey',
        description: 'Seasonal wildflower honey, creamed option available.',
        unit: 'kg',
      },
    },
  ],
  berries: [
    {
      email: 'farmer-berries-1@agrobridge.local',
      displayName: 'Salome Beridze',
      locale: LocaleCode.ka,
      farmName: 'Adjara Berry Farm',
      region: 'adjara',
      farmDescription: 'Blueberries and raspberries from coastal hills.',
      product: {
        title: 'Adjara blueberries',
        description: 'Firm blueberries packed for fresh retail and freezing.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-berries-2@agrobridge.local',
      displayName: 'Irakli Gelashvili',
      locale: LocaleCode.en,
      farmName: 'Kartli Raspberry Fields',
      region: 'shidaKartli',
      farmDescription: 'Seasonal raspberries for juice and fresh markets.',
      product: {
        title: 'Fresh raspberries',
        description: 'Same-day harvest raspberries in ventilated trays.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-berries-3@agrobridge.local',
      displayName: 'Vera Lomidze',
      locale: LocaleCode.ru,
      farmName: 'Guria Strawberry Cooperative',
      region: 'guria',
      farmDescription: 'Greenhouse and open-field strawberries.',
      product: {
        title: 'Guria strawberries',
        description: 'Sweet early strawberries for regional buyers.',
        unit: 'box',
      },
    },
  ],
  mineralWater: [
    {
      email: 'farmer-mineralWater-1@agrobridge.local',
      displayName: 'Davit Kobaladze',
      locale: LocaleCode.ka,
      farmName: 'Borjomi Valley Springs',
      region: 'samtskheJavakheti',
      farmDescription: 'Bottled mineral water from highland springs.',
      product: {
        title: 'Natural sparkling mineral water',
        description: 'Naturally carbonated mineral water, 0.5–1.5 L bottles.',
        unit: 'liter',
      },
    },
    {
      email: 'farmer-mineralWater-2@agrobridge.local',
      displayName: 'Helen Ward',
      locale: LocaleCode.en,
      farmName: 'Sairme Spring Co.',
      region: 'imereti',
      farmDescription: 'Still mineral water for HORECA and export.',
      product: {
        title: 'Still mineral water',
        description: 'Low-mineralization still water in PET and glass.',
        unit: 'liter',
      },
    },
  ],
  spices: [
    {
      email: 'farmer-spices-1@agrobridge.local',
      displayName: 'Nana Metreveli',
      locale: LocaleCode.ka,
      farmName: 'Adjara Spice Gardens',
      region: 'adjara',
      farmDescription: 'Dried Georgian spices and seasoning blends.',
      product: {
        title: 'Dried Georgian blue fenugreek',
        description: 'Utskho suneli / blue fenugreek for spice blends.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-spices-2@agrobridge.local',
      displayName: 'Irina Dolidze',
      locale: LocaleCode.ru,
      farmName: 'Kakheti Spice Collective',
      region: 'kakheti',
      farmDescription: 'Mountain thyme, savory, and mixed spice packs.',
      product: {
        title: 'Dried thyme and savory mix',
        description: 'Mountain thyme and savory for spice importers.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-spices-3@agrobridge.local',
      displayName: 'Giorgi Abashidze',
      locale: LocaleCode.en,
      farmName: 'Imereti Chili & Spice',
      region: 'imereti',
      farmDescription: 'Dried peppers and Georgian spice mixes.',
      product: {
        title: 'Dried adjika spice blend',
        description: 'Traditional adjika dry blend for food processors.',
        unit: 'kg',
      },
    },
  ],
  tea: [
    {
      email: 'farmer-tea-1@agrobridge.local',
      displayName: 'Otar Kekelidze',
      locale: LocaleCode.en,
      farmName: 'Guria Tea Gardens',
      region: 'guria',
      farmDescription: 'Georgian black and green tea from coastal plantations.',
      product: {
        title: 'Guria black tea',
        description: 'Orthodox leaf black tea, export-ready packing.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-tea-2@agrobridge.local',
      displayName: 'Tamar Chikovani',
      locale: LocaleCode.ka,
      farmName: 'Samegrelo Green Tea',
      region: 'samegreloZemoSvaneti',
      farmDescription: 'Small-batch green tea and herbal infusions.',
      product: {
        title: 'Georgian green tea',
        description: 'Light green tea with floral notes, bulk and retail packs.',
        unit: 'kg',
      },
    },
  ],
  bayLeaf: [
    {
      email: 'farmer-bayLeaf-1@agrobridge.local',
      displayName: 'Zurab Maisuradze',
      locale: LocaleCode.ka,
      farmName: 'Adjara Laurel Grove',
      region: 'adjara',
      farmDescription: 'Dried bay leaves from coastal laurel trees.',
      product: {
        title: 'Dried bay leaves',
        description: 'Whole dried bay leaves, sorted for food industry use.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-bayLeaf-2@agrobridge.local',
      displayName: 'Marina Kvitsiani',
      locale: LocaleCode.ru,
      farmName: 'Guria Laurel Co-op',
      region: 'guria',
      farmDescription: 'Bay leaf harvesting and sun-drying cooperative.',
      product: {
        title: 'Premium bay leaf grade A',
        description: 'Large whole leaves with strong aroma, bulk bags.',
        unit: 'kg',
      },
    },
  ],
  essentialOils: [
    {
      email: 'farmer-essentialOils-1@agrobridge.local',
      displayName: 'Luka Tsiklauri',
      locale: LocaleCode.en,
      farmName: 'Kakheti Distillery Botanica',
      region: 'kakheti',
      farmDescription: 'Essential oils from local aromatic plants.',
      product: {
        title: 'Lavender essential oil',
        description: 'Steam-distilled lavender oil for cosmetics and wellness.',
        unit: 'liter',
      },
    },
    {
      email: 'farmer-essentialOils-2@agrobridge.local',
      displayName: 'Ana Kharadze',
      locale: LocaleCode.ka,
      farmName: 'Adjara Citrus Oils',
      region: 'adjara',
      farmDescription: 'Cold-pressed citrus peel oils.',
      product: {
        title: 'Mandarin peel essential oil',
        description: 'Cold-pressed mandarin oil for fragrance and food use.',
        unit: 'liter',
      },
    },
  ],
  organic: [
    {
      email: 'farmer-organic-1@agrobridge.local',
      displayName: 'Nino Javakhishvili',
      locale: LocaleCode.ka,
      farmName: 'Organic Kartli Fields',
      region: 'shidaKartli',
      farmDescription: 'Certified organic vegetables and greens.',
      product: {
        title: 'Organic mixed vegetables',
        description: 'Seasonal organic crate for retailers and restaurants.',
        unit: 'box',
      },
    },
    {
      email: 'farmer-organic-2@agrobridge.local',
      displayName: 'Peter Klein',
      locale: LocaleCode.en,
      farmName: 'Organic Kakheti Orchard',
      region: 'kakheti',
      farmDescription: 'Organic fruit grown without synthetic pesticides.',
      product: {
        title: 'Organic dessert apples',
        description: 'Certified organic apples, graded for fresh market.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-organic-3@agrobridge.local',
      displayName: 'Elena Sokolova',
      locale: LocaleCode.ru,
      farmName: 'Organic Imereti Honey & Produce',
      region: 'imereti',
      farmDescription: 'Organic honey and small-batch farm produce.',
      product: {
        title: 'Organic wildflower honey',
        description: 'Organic-certified wildflower honey in bulk jars.',
        unit: 'kg',
      },
    },
  ],
};

async function upsertUser(params: {
  email: string;
  role: UserRole;
  displayName: string;
  locale: LocaleCode;
  passwordHash: string;
  sellerType?: 'privateFarmer' | 'company' | null;
  buyerType?: 'individual' | 'company' | null;
  emailVerifiedAt?: Date | null;
  phone?: string | null;
  phoneVerifiedAt?: Date | null;
}) {
  const sellerType =
    params.role === UserRole.farmer
      ? (params.sellerType ?? 'privateFarmer')
      : null;
  const buyerType =
    params.role === UserRole.buyer
      ? (params.buyerType ?? 'individual')
      : null;

  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      role: params.role,
      displayName: params.displayName,
      locale: params.locale,
      passwordHash: params.passwordHash,
      sellerType,
      buyerType,
      emailVerifiedAt: params.emailVerifiedAt ?? undefined,
      phone: params.phone ?? undefined,
      phoneVerifiedAt: params.phoneVerifiedAt ?? undefined,
    },
    create: {
      email: params.email,
      role: params.role,
      displayName: params.displayName,
      locale: params.locale,
      passwordHash: params.passwordHash,
      sellerType,
      buyerType,
      emailVerifiedAt: params.emailVerifiedAt ?? null,
      phone: params.phone ?? null,
      phoneVerifiedAt: params.phoneVerifiedAt ?? null,
    },
  });
}

async function seedFarmer(
  category: string,
  farmer: DemoFarmer,
  passwordHash: string,
  adminId: string,
  index: number,
  globalIndex: number,
) {
  const richness = richnessFor(globalIndex);
  const sellerType = index % 2 === 0 ? 'privateFarmer' : 'company';
  const pendingReview = index === 0 && category === 'fruits';
  const verifiedNow = new Date();
  const user = await upsertUser({
    email: farmer.email,
    role: UserRole.farmer,
    displayName: farmer.displayName,
    locale: farmer.locale,
    passwordHash,
    sellerType,
    emailVerifiedAt: verifiedNow,
    phone: `+99555500${String(1000 + globalIndex).slice(-4)}`,
    phoneVerifiedAt: verifiedNow,
  });

  const companyRegistrationNumber =
    sellerType === 'company' ? `40${String(1000000 + globalIndex).slice(-7)}` : null;

  const farm = await prisma.farm.upsert({
    where: { ownerId: user.id },
    update: {
      name: farmer.farmName,
      region: farmer.region,
      description: farmer.farmDescription,
      verificationStatus: pendingReview
        ? VerificationStatus.pending
        : VerificationStatus.approved,
      verificationNote: pendingReview
        ? 'Awaiting moderator review of ID document'
        : sellerType === 'company'
          ? 'Verified via email, SMS, and company registry check'
          : 'Verified via email, SMS, and ID document review',
      verifiedAt: pendingReview ? null : verifiedNow,
      verifiedById: pendingReview ? null : adminId,
      companyRegistrationNumber,
      companyRegistryName:
        sellerType === 'company' ? `Registry stub company ${companyRegistrationNumber}` : null,
      companyRegistryCheckedAt: sellerType === 'company' ? verifiedNow : null,
      companyRegistryValid: sellerType === 'company' ? true : null,
    },
    create: {
      ownerId: user.id,
      name: farmer.farmName,
      region: farmer.region,
      description: farmer.farmDescription,
      verificationStatus: pendingReview
        ? VerificationStatus.pending
        : VerificationStatus.approved,
      verificationNote: pendingReview
        ? 'Awaiting moderator review of ID document'
        : null,
      verifiedAt: pendingReview ? null : verifiedNow,
      verifiedById: pendingReview ? null : adminId,
      companyRegistrationNumber,
      companyRegistryName:
        sellerType === 'company' ? `Registry stub company ${companyRegistrationNumber}` : null,
      companyRegistryCheckedAt: sellerType === 'company' ? verifiedNow : null,
      companyRegistryValid: sellerType === 'company' ? true : null,
    },
  });

  await enrichDemoFarm({
    prisma,
    farmId: farm.id,
    richness,
    globalIndex,
    region: farmer.region,
    farmName: farmer.farmName,
  });

  // Demo verification document for the pending private farmer (and a few approved ones).
  if (index === 0) {
    await prisma.farmDocument.deleteMany({ where: { farmId: farm.id } });
    const key = `farms/${farm.id}/documents/demo-id-card.txt`;
    const absolute = join(UPLOADS_DIR, key);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(
      absolute,
      `Demo ID card document for ${farmer.farmName}\n`,
      'utf8',
    );
    await prisma.farmDocument.create({
      data: {
        farmId: farm.id,
        title: 'ID card',
        fileName: 'id-card.txt',
        url: `/api/uploads/${key}`,
        key,
        mimeType: 'application/pdf',
        kind: 'idCard',
        reviewStatus: pendingReview
          ? DocumentReviewStatus.pending
          : DocumentReviewStatus.approved,
        reviewedAt: pendingReview ? null : verifiedNow,
        reviewedById: pendingReview ? null : adminId,
      },
    });
  }
  // Keep seed idempotent: replace demo products for this farm.
  const existing = await prisma.product.findMany({
    where: { farmId: farm.id },
    select: {
      id: true,
      images: { select: { key: true } },
      videos: { select: { key: true } },
      certificates: { select: { key: true } },
    },
  });
  for (const product of existing) {
    for (const image of product.images) {
      await rm(join(UPLOADS_DIR, image.key), { force: true }).catch(() => undefined);
    }
    for (const video of product.videos) {
      await rm(join(UPLOADS_DIR, video.key), { force: true }).catch(() => undefined);
    }
    for (const certificate of product.certificates) {
      await rm(join(UPLOADS_DIR, certificate.key), { force: true }).catch(() => undefined);
    }
  }
  await prisma.product.deleteMany({ where: { farmId: farm.id } });

  const quantity =
    farmer.product.minQuantity != null && farmer.product.maxQuantity != null
      ? {
          minQuantity: farmer.product.minQuantity,
          maxQuantity: farmer.product.maxQuantity,
        }
      : quantityForUnit(farmer.product.unit, globalIndex);

  const harvestPlan = harvestPlanFor(richness, globalIndex);
  const now = new Date();
  const startOffset = farmer.product.harvestOffsetDays?.start ?? harvestPlan.startOffset;
  const endOffset = farmer.product.harvestOffsetDays?.end ?? harvestPlan.endOffset;
  const harvestStartAt = new Date(now);
  harvestStartAt.setUTCDate(harvestStartAt.getUTCDate() + startOffset);
  const harvestEndAt = new Date(now);
  harvestEndAt.setUTCDate(harvestEndAt.getUTCDate() + endOffset);

  const defaultSeason =
    farmer.product.seasonMonths ??
    Array.from({ length: 3 }, (_, i) => ((harvestStartAt.getUTCMonth() + i) % 12) + 1);

  const harvestStatus = farmer.product.harvestStatus ?? harvestPlan.status;
  const enriched = await buildEnrichedProductData({
    category,
    title: farmer.product.title,
    region: farmer.region,
    richness,
    globalIndex,
    quantity,
  });

  const product = await prisma.product.create({
    data: {
      ownerUserId: user.id,
      farmId: farm.id,
      title: farmer.product.title,
      description: farmer.product.description,
      category,
      unit: farmer.product.unit,
      minQuantity: quantity.minQuantity,
      maxQuantity: quantity.maxQuantity,
      seasonMonths: defaultSeason,
      harvestStartAt,
      harvestEndAt,
      forecastQuantity: farmer.product.forecastQuantity ?? quantity.maxQuantity,
      harvestStatus,
      preorderEnabled:
        farmer.product.preorderEnabled ?? harvestPlan.preorder,
      isPublished: true,
      moderationStatus: ModerationStatus.approved,
      moderatedAt: new Date(),
      moderatedById: adminId,
      ...enriched,
    },
  });

  await seedProductMedia({
    prisma,
    productId: product.id,
    category,
    uploadsDir: UPLOADS_DIR,
    categoryImageDir: CATEGORY_IMAGE_DIR,
    richness,
    adminId,
  });

  return { user, farm, product, richness };
}

async function removeObsoleteDemoData() {
  const obsoleteEmails = [
    'farmer-herbs-1@agrobridge.local',
    'farmer-herbs-2@agrobridge.local',
    'farmer-herbs-3@agrobridge.local',
  ];

  const obsoleteUsers = await prisma.user.findMany({
    where: { email: { in: obsoleteEmails } },
    select: { id: true, farm: { select: { products: { select: { images: true } } } } },
  });
  for (const user of obsoleteUsers) {
    for (const product of user.farm?.products ?? []) {
      for (const image of product.images) {
        await rm(join(UPLOADS_DIR, image.key), { force: true }).catch(() => undefined);
      }
    }
  }
  if (obsoleteUsers.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: obsoleteEmails } } });
  }

  const leftoverHerbs = await prisma.product.findMany({
    where: { category: 'herbs' },
    select: { id: true, images: { select: { key: true } } },
  });
  for (const product of leftoverHerbs) {
    for (const image of product.images) {
      await rm(join(UPLOADS_DIR, image.key), { force: true }).catch(() => undefined);
    }
  }
  if (leftoverHerbs.length > 0) {
    await prisma.product.deleteMany({ where: { category: 'herbs' } });
  }
}

async function main() {
  const adminEmail = (
    process.env.ADMIN_EMAIL ?? 'admin@agrobridge.local'
  ).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMeAdmin1';
  const adminDisplayName = process.env.ADMIN_DISPLAY_NAME ?? 'AgroBridge Admin';

  await removeObsoleteDemoData();

  const [adminPasswordHash, demoPasswordHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(DEMO_PASSWORD, 12),
  ]);

  const admin = await upsertUser({
    email: adminEmail,
    role: UserRole.admin,
    displayName: adminDisplayName,
    locale: LocaleCode.en,
    passwordHash: adminPasswordHash,
    // Admin desk requires a verified email; skip the inbox loop for the seeded account.
    emailVerifiedAt: new Date(),
  });
  console.log(`Admin ready: ${admin.email}`);

  for (const [index, id] of PRODUCT_CATEGORIES.entries()) {
    await prisma.categoryConfig.upsert({
      where: { id },
      create: { id, enabled: true, sortOrder: index },
      update: {},
    });
  }

  // Buyers must be email-verified: chat + LocaleSync (cabinet/me/locale) require EmailVerifiedGuard.
  const buyersVerifiedAt = new Date();
  for (const [index, buyer] of BUYERS.entries()) {
    await upsertUser({
      email: buyer.email,
      role: UserRole.buyer,
      displayName: buyer.displayName,
      locale: buyer.locale,
      passwordHash: demoPasswordHash,
      buyerType: index % 2 === 0 ? 'individual' : 'company',
      emailVerifiedAt: buyersVerifiedAt,
    });
  }
  console.log(`Buyers ready: ${BUYERS.length}`);

  let farmerCount = 0;
  let productCount = 0;
  let globalIndex = 0;
  const richnessCounts = { sparse: 0, light: 0, medium: 0, full: 0 };
  for (const [category, farmers] of Object.entries(FARMERS_BY_CATEGORY)) {
    for (const [index, farmer] of farmers.entries()) {
      const seeded = await seedFarmer(
        category,
        farmer,
        demoPasswordHash,
        admin.id,
        index,
        globalIndex,
      );
      richnessCounts[seeded.richness] += 1;
      farmerCount += 1;
      productCount += 1;
      globalIndex += 1;
    }
    console.log(`Category ${category}: ${farmers.length} farmers/products`);
  }
  console.log(
    `Card richness mix: sparse=${richnessCounts.sparse}, light=${richnessCounts.light}, medium=${richnessCounts.medium}, full=${richnessCounts.full}`,
  );

  const deals = await seedCompletedDeals();
  const purchaseRequests = await seedPurchaseRequests();
  console.log(
    `Demo seed complete: ${farmerCount} farmers, ${productCount} products, ${BUYERS.length} buyers, ${deals} completed deals with ratings, ${purchaseRequests} open purchase requests`,
  );
  console.log(`Demo password for farmers/buyers: ${DEMO_PASSWORD}`);
  console.log('Example logins: farmer-fruits-1@agrobridge.local / buyer-1@agrobridge.local');
}

async function seedCompletedDeals() {
  /**
   * Varied seller ratings across the catalog:
   * - some farms with many high scores
   * - some mid / mixed
   * - some low
   * - most remain unrated
   */
  const pairs: Array<{
    buyerEmail: string;
    farmerEmail: string;
    buyerScore: number;
    sellerScore: number;
    quantity: string;
    price: string;
    comment: string;
  }> = [
    // fruits-1: excellent, 4 ratings
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      farmerEmail: 'farmer-fruits-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '200',
      price: '4.50',
      comment: 'Excellent peaches and clear packing specs.',
    },
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      farmerEmail: 'farmer-fruits-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 4,
      quantity: '150',
      price: '4.40',
      comment: 'On-time shipment, good communication.',
    },
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      farmerEmail: 'farmer-fruits-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '180',
      price: '4.55',
      comment: 'Consistent quality across pallets.',
    },
    {
      buyerEmail: 'buyer-4@agrobridge.local',
      farmerEmail: 'farmer-fruits-1@agrobridge.local',
      buyerScore: 4,
      sellerScore: 5,
      quantity: '120',
      price: '4.35',
      comment: 'Reliable partner for repeat orders.',
    },
    // wine-1: strong, 3 ratings
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      farmerEmail: 'farmer-wine-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '120',
      price: '18.00',
      comment: 'Great qvevri profile for retail.',
    },
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      farmerEmail: 'farmer-wine-1@agrobridge.local',
      buyerScore: 4,
      sellerScore: 4,
      quantity: '90',
      price: '17.50',
      comment: 'Solid labels and export docs.',
    },
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      farmerEmail: 'farmer-wine-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '60',
      price: '18.20',
      comment: 'Would reorder for next season.',
    },
    // honey-1: perfect 2 ratings
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      farmerEmail: 'farmer-honey-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '80',
      price: '22.00',
      comment: 'Clean lab results and stable moisture.',
    },
    {
      buyerEmail: 'buyer-4@agrobridge.local',
      farmerEmail: 'farmer-honey-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '50',
      price: '21.50',
      comment: 'Premium jar presentation.',
    },
    // nuts-1: mixed mid, 2 ratings
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      farmerEmail: 'farmer-nuts-1@agrobridge.local',
      buyerScore: 3,
      sellerScore: 4,
      quantity: '500',
      price: '9.20',
      comment: 'Good kernels, slower reply times.',
    },
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      farmerEmail: 'farmer-nuts-1@agrobridge.local',
      buyerScore: 4,
      sellerScore: 3,
      quantity: '300',
      price: '9.00',
      comment: 'Acceptable grade after sorting notes.',
    },
    // berries-1: high single
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      farmerEmail: 'farmer-berries-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '2',
      price: '6.80',
      comment: 'Firm fruit, export-ready packs.',
    },
    // vegetables-2: low single
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      farmerEmail: 'farmer-vegetables-2@agrobridge.local',
      buyerScore: 2,
      sellerScore: 3,
      quantity: '1000',
      price: '0.75',
      comment: 'Delays and uneven sizing.',
    },
    // dairy-1: mid single
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      farmerEmail: 'farmer-dairy-1@agrobridge.local',
      buyerScore: 4,
      sellerScore: 4,
      quantity: '200',
      price: '5.10',
      comment: 'Fresh product, cold chain OK.',
    },
    // tea-1: mixed 2
    {
      buyerEmail: 'buyer-4@agrobridge.local',
      farmerEmail: 'farmer-tea-1@agrobridge.local',
      buyerScore: 3,
      sellerScore: 4,
      quantity: '100',
      price: '7.40',
      comment: 'Decent leaf, packaging can improve.',
    },
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      farmerEmail: 'farmer-tea-1@agrobridge.local',
      buyerScore: 4,
      sellerScore: 3,
      quantity: '80',
      price: '7.20',
      comment: 'Stable supply, average aroma.',
    },
    // organic-1: high 3
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      farmerEmail: 'farmer-organic-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '400',
      price: '2.60',
      comment: 'Certificates ready, clean crates.',
    },
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      farmerEmail: 'farmer-organic-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 4,
      quantity: '250',
      price: '2.55',
      comment: 'Strong organic story for retail.',
    },
    {
      buyerEmail: 'buyer-4@agrobridge.local',
      farmerEmail: 'farmer-organic-1@agrobridge.local',
      buyerScore: 4,
      sellerScore: 5,
      quantity: '180',
      price: '2.70',
      comment: 'Would expand weekly volume.',
    },
    // mineralWater-1: one mid
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      farmerEmail: 'farmer-mineralWater-1@agrobridge.local',
      buyerScore: 3,
      sellerScore: 4,
      quantity: '2000',
      price: '0.48',
      comment: 'OK logistics, labels need refresh.',
    },
    // spices-1: one high
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      farmerEmail: 'farmer-spices-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '100',
      price: '10.20',
      comment: 'Aroma and dryness were excellent.',
    },
    // essentialOils-1: low-mid
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      farmerEmail: 'farmer-essentialOils-1@agrobridge.local',
      buyerScore: 2,
      sellerScore: 3,
      quantity: '20',
      price: '46.00',
      comment: 'Docs incomplete on first shipment.',
    },
    // bayLeaf-1: high single
    {
      buyerEmail: 'buyer-4@agrobridge.local',
      farmerEmail: 'farmer-bayLeaf-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 4,
      quantity: '300',
      price: '5.60',
      comment: 'Large leaves, strong aroma.',
    },
  ];

  let created = 0;
  for (const [pairIndex, pair] of pairs.entries()) {
    const buyer = await prisma.user.findUnique({ where: { email: pair.buyerEmail } });
    const farmer = await prisma.user.findUnique({
      where: { email: pair.farmerEmail },
      include: { farm: { include: { products: { take: 1, orderBy: { createdAt: 'asc' } } } } },
    });
    if (!buyer || !farmer?.farm || !farmer.farm.products[0]) {
      continue;
    }

    const product = farmer.farm.products[0];
    const demoKey = `demo-deal-${pairIndex}-${pair.buyerEmail}-${pair.farmerEmail}`;
    const existing = await prisma.rfq.findFirst({
      where: {
        buyerId: buyer.id,
        farmId: farmer.farm.id,
        status: RfqStatus.completed,
        message: demoKey,
      },
    });
    if (existing) {
      created += 1;
      continue;
    }

    // Remove older non-keyed completed demo deals for this pair so re-seed stays clean.
    await prisma.rfq.deleteMany({
      where: {
        buyerId: buyer.id,
        farmId: farmer.farm.id,
        status: RfqStatus.completed,
        message: { startsWith: 'Demo completed deal' },
      },
    });

    await prisma.rfq.create({
      data: {
        productId: product.id,
        farmId: farmer.farm.id,
        buyerId: buyer.id,
        quantity: pair.quantity,
        unit: product.unit,
        message: demoKey,
        status: RfqStatus.completed,
        completedAt: new Date(Date.now() - pairIndex * 86_400_000),
        offer: {
          create: {
            priceAmount: pair.price,
            currency: CurrencyCode.EUR,
            quantity: pair.quantity,
            unit: product.unit,
            message: 'Demo offer accepted and fulfilled.',
          },
        },
        ratings: {
          create: [
            {
              fromUserId: buyer.id,
              toUserId: farmer.id,
              score: pair.buyerScore,
              comment: pair.comment,
            },
            {
              fromUserId: farmer.id,
              toUserId: buyer.id,
              score: pair.sellerScore,
              comment: 'Smooth coordination after acceptance.',
            },
          ],
        },
      },
    });
    created += 1;
  }
  return created;
}

async function seedPurchaseRequests() {
  const samples = [
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      title: 'Export-grade blueberries',
      category: 'berries',
      quantity: '2',
      unit: 'ton',
      variety: 'Duke',
      packaging: '1 kg clamshells in 5 kg cartons',
      destinationCountry: 'Italy',
      message: 'Need weekly shipments through September. Prefer GLOBALG.A.P. farms.',
      quoteFarmerEmail: 'farmer-berries-1@agrobridge.local',
      quotePrice: '6.80',
    },
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      title: 'Saperavi wine for retail',
      category: 'wine',
      quantity: '3000',
      unit: 'bottle',
      variety: 'Saperavi',
      packaging: '0.75 L glass bottles, 6-pack cartons',
      destinationCountry: 'Germany',
      message: 'Looking for 2023–2024 vintage. Need EU label-ready lots.',
      quoteFarmerEmail: null,
      quotePrice: null,
    },
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      title: 'Mountain flower honey',
      category: 'honey',
      quantity: '500',
      unit: 'kg',
      variety: 'Wildflower',
      packaging: 'Bulk drums + 250 g retail jars sample pack',
      destinationCountry: 'France',
      message: 'Organic preferred. Please include lab analysis if available.',
      quoteFarmerEmail: 'farmer-honey-1@agrobridge.local',
      quotePrice: '18.50',
    },
    {
      buyerEmail: 'buyer-4@agrobridge.local',
      title: 'Natural mineral water',
      category: 'mineralWater',
      quantity: '20000',
      unit: 'liter',
      variety: null,
      packaging: '0.5 L PET and 1.5 L PET',
      destinationCountry: 'United Arab Emirates',
      message: 'Need FOB Poti quote and earliest loading date.',
      quoteFarmerEmail: null,
      quotePrice: null,
    },
  ];

  let created = 0;
  for (const sample of samples) {
    const buyer = await prisma.user.findUnique({ where: { email: sample.buyerEmail } });
    if (!buyer) continue;

    const existing = await prisma.purchaseRequest.findFirst({
      where: {
        buyerId: buyer.id,
        title: sample.title,
        status: PurchaseRequestStatus.open,
      },
    });
    if (existing) {
      created += 1;
      continue;
    }

    const request = await prisma.purchaseRequest.create({
      data: {
        buyerId: buyer.id,
        title: sample.title,
        category: sample.category,
        quantity: sample.quantity,
        unit: sample.unit,
        variety: sample.variety,
        packaging: sample.packaging,
        destinationCountry: sample.destinationCountry,
        message: sample.message,
        status: PurchaseRequestStatus.open,
      },
    });

    if (sample.quoteFarmerEmail && sample.quotePrice) {
      const farmer = await prisma.user.findUnique({
        where: { email: sample.quoteFarmerEmail },
        include: { farm: true },
      });
      if (farmer?.farm) {
        await prisma.purchaseQuote.create({
          data: {
            requestId: request.id,
            farmId: farmer.farm.id,
            priceAmount: sample.quotePrice,
            currency: CurrencyCode.EUR,
            quantity: sample.quantity,
            unit: sample.unit,
            message: 'Demo quote from matching Georgian farm.',
            status: PurchaseQuoteStatus.pending,
          },
        });
      }
    }

    created += 1;
  }

  return created;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
