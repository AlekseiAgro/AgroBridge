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
import { copyFile, mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { PRODUCT_CATEGORIES } from '@agrobridge/shared';

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
}) {
  return prisma.user.upsert({
    where: { email: params.email },
    update: {
      role: params.role,
      displayName: params.displayName,
      locale: params.locale,
      passwordHash: params.passwordHash,
    },
    create: {
      email: params.email,
      role: params.role,
      displayName: params.displayName,
      locale: params.locale,
      passwordHash: params.passwordHash,
    },
  });
}

async function seedProductImage(params: {
  productId: string;
  category: string;
  adminId: string;
}) {
  const source = join(CATEGORY_IMAGE_DIR, `${params.category}.jpg`);
  const key = `products/${params.productId}/seed-${params.category}.jpg`;
  const absolute = join(UPLOADS_DIR, key);

  await mkdir(dirname(absolute), { recursive: true });
  try {
    await copyFile(source, absolute);
  } catch {
    // Category image missing — product still usable without a photo.
    return;
  }

  await prisma.productImage.deleteMany({ where: { productId: params.productId } });
  await prisma.productImage.create({
    data: {
      productId: params.productId,
      // Same-origin path; Next.js proxies /api/uploads/* to the API.
      url: `/api/uploads/${key}`,
      key,
      sortOrder: 0,
      isPrimary: true,
    },
  });
}

async function seedFarmer(
  category: string,
  farmer: DemoFarmer,
  passwordHash: string,
  adminId: string,
  index: number,
) {
  const user = await upsertUser({
    email: farmer.email,
    role: UserRole.farmer,
    displayName: farmer.displayName,
    locale: farmer.locale,
    passwordHash,
  });

  const farm = await prisma.farm.upsert({
    where: { ownerId: user.id },
    update: {
      name: farmer.farmName,
      region: farmer.region,
      description: farmer.farmDescription,
      verificationStatus:
        index === 0 && category === 'fruits'
          ? VerificationStatus.pending
          : VerificationStatus.approved,
      verificationNote: null,
      verifiedAt:
        index === 0 && category === 'fruits' ? null : new Date(),
      verifiedById: index === 0 && category === 'fruits' ? null : adminId,
    },
    create: {
      ownerId: user.id,
      name: farmer.farmName,
      region: farmer.region,
      description: farmer.farmDescription,
      verificationStatus:
        index === 0 && category === 'fruits'
          ? VerificationStatus.pending
          : VerificationStatus.approved,
      verifiedAt:
        index === 0 && category === 'fruits' ? null : new Date(),
      verifiedById: index === 0 && category === 'fruits' ? null : adminId,
    },
  });

  // Demo verification document for the pending farm (and a few approved ones).
  if (index === 0) {
    await prisma.farmDocument.deleteMany({ where: { farmId: farm.id } });
    const key = `farms/${farm.id}/documents/demo-registration.txt`;
    const absolute = join(UPLOADS_DIR, key);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(
      absolute,
      `Demo registration document for ${farmer.farmName}\n`,
      'utf8',
    );
    await prisma.farmDocument.create({
      data: {
        farmId: farm.id,
        title: 'Farm registration certificate',
        fileName: 'registration.txt',
        url: `/api/uploads/${key}`,
        key,
        mimeType: 'application/pdf',
        reviewStatus:
          category === 'fruits'
            ? DocumentReviewStatus.pending
            : DocumentReviewStatus.approved,
        reviewedAt: category === 'fruits' ? null : new Date(),
        reviewedById: category === 'fruits' ? null : adminId,
      },
    });
  }
  // Keep seed idempotent: replace demo products for this farm.
  const existing = await prisma.product.findMany({
    where: { farmId: farm.id },
    select: { id: true, images: { select: { key: true } } },
  });
  for (const product of existing) {
    for (const image of product.images) {
      await rm(join(UPLOADS_DIR, image.key), { force: true }).catch(() => undefined);
    }
  }
  await prisma.product.deleteMany({ where: { farmId: farm.id } });

  const quantity =
    farmer.product.minQuantity != null && farmer.product.maxQuantity != null
      ? {
          minQuantity: farmer.product.minQuantity,
          maxQuantity: farmer.product.maxQuantity,
        }
      : quantityForUnit(farmer.product.unit, index);

  const product = await prisma.product.create({
    data: {
      farmId: farm.id,
      title: farmer.product.title,
      description: farmer.product.description,
      category,
      unit: farmer.product.unit,
      minQuantity: quantity.minQuantity,
      maxQuantity: quantity.maxQuantity,
      isPublished: true,
      moderationStatus: ModerationStatus.approved,
      moderatedAt: new Date(),
      moderatedById: adminId,
    },
  });

  await seedProductImage({
    productId: product.id,
    category,
    adminId,
  });

  return { user, farm, product };
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
  });
  console.log(`Admin ready: ${admin.email}`);

  for (const [index, id] of PRODUCT_CATEGORIES.entries()) {
    await prisma.categoryConfig.upsert({
      where: { id },
      create: { id, enabled: true, sortOrder: index },
      update: {},
    });
  }

  for (const buyer of BUYERS) {
    await upsertUser({
      email: buyer.email,
      role: UserRole.buyer,
      displayName: buyer.displayName,
      locale: buyer.locale,
      passwordHash: demoPasswordHash,
    });
  }
  console.log(`Buyers ready: ${BUYERS.length}`);

  let farmerCount = 0;
  let productCount = 0;
  for (const [category, farmers] of Object.entries(FARMERS_BY_CATEGORY)) {
    for (const [index, farmer] of farmers.entries()) {
      await seedFarmer(category, farmer, demoPasswordHash, admin.id, index);
      farmerCount += 1;
      productCount += 1;
    }
    console.log(`Category ${category}: ${farmers.length} farmers/products`);
  }

  const deals = await seedCompletedDeals();
  const purchaseRequests = await seedPurchaseRequests();
  console.log(
    `Demo seed complete: ${farmerCount} farmers, ${productCount} products, ${BUYERS.length} buyers, ${deals} completed deals with ratings, ${purchaseRequests} open purchase requests`,
  );
  console.log(`Demo password for farmers/buyers: ${DEMO_PASSWORD}`);
  console.log('Example logins: farmer-fruits-1@agrobridge.local / buyer-1@agrobridge.local');
}

async function seedCompletedDeals() {
  const pairs = [
    {
      buyerEmail: 'buyer-1@agrobridge.local',
      farmerEmail: 'farmer-fruits-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 4,
      quantity: '200',
      price: '4.50',
    },
    {
      buyerEmail: 'buyer-2@agrobridge.local',
      farmerEmail: 'farmer-wine-1@agrobridge.local',
      buyerScore: 4,
      sellerScore: 5,
      quantity: '120',
      price: '18.00',
    },
    {
      buyerEmail: 'buyer-3@agrobridge.local',
      farmerEmail: 'farmer-honey-1@agrobridge.local',
      buyerScore: 5,
      sellerScore: 5,
      quantity: '80',
      price: '22.00',
    },
    {
      buyerEmail: 'buyer-4@agrobridge.local',
      farmerEmail: 'farmer-nuts-1@agrobridge.local',
      buyerScore: 3,
      sellerScore: 4,
      quantity: '500',
      price: '9.20',
    },
  ];

  let created = 0;
  for (const pair of pairs) {
    const buyer = await prisma.user.findUnique({ where: { email: pair.buyerEmail } });
    const farmer = await prisma.user.findUnique({
      where: { email: pair.farmerEmail },
      include: { farm: { include: { products: { take: 1, orderBy: { createdAt: 'asc' } } } } },
    });
    if (!buyer || !farmer?.farm || !farmer.farm.products[0]) {
      continue;
    }

    const product = farmer.farm.products[0];
    // Keep seed idempotent: one completed demo deal per buyer+farmer pair.
    const existing = await prisma.rfq.findFirst({
      where: {
        buyerId: buyer.id,
        farmId: farmer.farm.id,
        status: RfqStatus.completed,
      },
    });
    if (existing) {
      created += 1;
      continue;
    }

    const rfq = await prisma.rfq.create({
      data: {
        productId: product.id,
        farmId: farmer.farm.id,
        buyerId: buyer.id,
        quantity: pair.quantity,
        unit: product.unit,
        message: 'Demo completed deal for rating showcase.',
        status: RfqStatus.completed,
        completedAt: new Date(),
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
              comment: 'Reliable supply and clear communication.',
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
    void rfq;
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
