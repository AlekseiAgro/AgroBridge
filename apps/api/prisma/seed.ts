import {
  LocaleCode,
  ModerationStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { copyFile, mkdir, rm } from 'fs/promises';
import { dirname, join, resolve } from 'path';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'DemoPass123';
const API_PUBLIC_URL = (
  process.env.API_PUBLIC_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');
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
};

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
      farmName: 'Adjara Berry Farm',
      region: 'adjara',
      farmDescription: 'Blueberries and wild-style berries from Adjara.',
      product: {
        title: 'Adjara blueberries',
        description: 'Cool-climate blueberries, IQF-ready or fresh pack.',
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
  herbs: [
    {
      email: 'farmer-herbs-1@agrobridge.local',
      displayName: 'Nana Metreveli',
      locale: LocaleCode.ka,
      farmName: 'Adjara Herb Gardens',
      region: 'adjara',
      farmDescription: 'Culinary herbs and dried tea blends.',
      product: {
        title: 'Dried Georgian blue fenugreek',
        description: 'Utskho suneli / blue fenugreek for spice blends.',
        unit: 'kg',
      },
    },
    {
      email: 'farmer-herbs-2@agrobridge.local',
      displayName: 'Otar Kekelidze',
      locale: LocaleCode.en,
      farmName: 'Imereti Mint & Basil',
      region: 'imereti',
      farmDescription: 'Fresh culinary herbs for restaurants.',
      product: {
        title: 'Fresh basil bunches',
        description: 'Genovese-style basil, same-day harvest packing.',
        unit: 'box',
      },
    },
    {
      email: 'farmer-herbs-3@agrobridge.local',
      displayName: 'Irina Dolidze',
      locale: LocaleCode.ru,
      farmName: 'Kakheti Saffron & Herbs',
      region: 'kakheti',
      farmDescription: 'Specialty herbs and limited saffron trials.',
      product: {
        title: 'Dried thyme and savory mix',
        description: 'Mountain thyme and savory for spice importers.',
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
      url: `${API_PUBLIC_URL}/api/uploads/${key}`,
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
    },
    create: {
      ownerId: user.id,
      name: farmer.farmName,
      region: farmer.region,
      description: farmer.farmDescription,
    },
  });

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

  const product = await prisma.product.create({
    data: {
      farmId: farm.id,
      title: farmer.product.title,
      description: farmer.product.description,
      category,
      unit: farmer.product.unit,
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

async function main() {
  const adminEmail = (
    process.env.ADMIN_EMAIL ?? 'admin@agrobridge.local'
  ).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMeAdmin1';
  const adminDisplayName = process.env.ADMIN_DISPLAY_NAME ?? 'AgroBridge Admin';

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
    for (const farmer of farmers) {
      await seedFarmer(category, farmer, demoPasswordHash, admin.id);
      farmerCount += 1;
      productCount += 1;
    }
    console.log(`Category ${category}: ${farmers.length} farmers/products`);
  }

  console.log(
    `Demo seed complete: ${farmerCount} farmers, ${productCount} products, ${BUYERS.length} buyers`,
  );
  console.log(`Demo password for farmers/buyers: ${DEMO_PASSWORD}`);
  console.log('Example logins: farmer-fruits-1@agrobridge.local / buyer-1@agrobridge.local');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
