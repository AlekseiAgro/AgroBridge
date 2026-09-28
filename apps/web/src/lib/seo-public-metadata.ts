import {
  formatListedPrice,
  isProductCategory,
  isProductUnit,
  isPubliclyListedProduct,
  type FarmDetail,
  type ProductDetail,
  type PurchaseRequestDetail,
} from '@agrobridge/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { formatProductQuantityRange } from './product-quantity';
import { formatProductDescription, formatProductTitle } from './product-title';
import { formatRegionLabel } from './region';
import {
  farmMetadataCopy,
  distinctPublicOrigin,
  productMetadataCopy,
  requestMetadataCopy,
} from './seo-page-metadata';

export const STATIC_SEO_PAGES = [
  'home',
  'catalog',
  'requests',
  'buyers',
  'sellers',
  'howItWorks',
  'support',
  'legal',
  'terms',
  'privacy',
] as const;

export type StaticSeoPage = (typeof STATIC_SEO_PAGES)[number];

function copyMetadata(title: string, description: string): Metadata {
  const metadata: Metadata = {};
  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  if (cleanTitle) metadata.title = cleanTitle;
  if (cleanDescription) metadata.description = cleanDescription;
  return metadata;
}

export async function staticPublicMetadata(locale: string, page: StaticSeoPage): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  return copyMetadata(t(`${page}.title`), t(`${page}.description`));
}

export async function productPageMetadata(
  product: ProductDetail,
  locale: string,
): Promise<Metadata> {
  if (!isPubliclyListedProduct(product)) return {};

  const t = await getTranslations({ locale, namespace: 'seo' });
  const tc = await getTranslations({ locale, namespace: 'catalog' });
  const tp = await getTranslations({ locale, namespace: 'product' });
  const th = await getTranslations({ locale, namespace: 'harvest' });
  const tRoot = await getTranslations({ locale });

  const title = formatProductTitle(product.title, locale);
  const category =
    product.category && isProductCategory(product.category)
      ? tc(`categories.${product.category}`)
      : null;
  const region = formatRegionLabel(product.farm?.region, tRoot);
  const place = product.farm?.name?.trim() || region;
  const originValue = distinctPublicOrigin(product.originPlace?.trim() || product.country, place);
  const price = formatListedPrice(product);
  const unitLabel =
    product.unit && isProductUnit(product.unit) ? tp(`units.${product.unit}`) : null;
  const quantity = formatProductQuantityRange(product, unitLabel);
  const availability = product.harvestStatus ? th(`status.${product.harvestStatus}`) : null;
  const season = product.seasonMonths.length
    ? product.seasonMonths.map((month) => th(`months.${month}`)).join(', ')
    : null;
  const copy = productMetadataCopy({
    title,
    category,
    place,
    description: formatProductDescription(product.description, locale) || null,
    price: price ? t('product.price', { price }) : null,
    availability: availability ? t('product.availability', { status: availability }) : null,
    quantity: quantity ? t('product.quantity', { quantity }) : null,
    origin: originValue ? t('product.origin', { origin: originValue }) : null,
    variety: product.variety?.trim()
      ? t('product.variety', { variety: product.variety.trim() })
      : null,
    season: season ? t('product.season', { months: season }) : null,
  });
  return copyMetadata(copy.title, copy.description);
}

export async function farmPageMetadata(farm: FarmDetail, locale: string): Promise<Metadata> {
  const name = farm.name?.trim() ?? '';
  if (!name) return {};

  const t = await getTranslations({ locale, namespace: 'seo' });
  const tc = await getTranslations({ locale, namespace: 'catalog' });
  const tRoot = await getTranslations({ locale });
  const region = formatRegionLabel(farm.region, tRoot);
  const categories = [
    ...new Set(
      farm.products
        .filter(isPubliclyListedProduct)
        .map((product) =>
          product.category && isProductCategory(product.category)
            ? tc(`categories.${product.category}`)
            : '',
        )
        .filter(Boolean),
    ),
  ].slice(0, 3);
  const markets = farm.exportMarkets
    .map((market) => market.trim())
    .filter(Boolean)
    .slice(0, 3);
  const copy = farmMetadataCopy({
    name,
    region,
    description: farm.description?.trim() || null,
    fallback: t('farm.fallback', { name }),
    categories: categories.length
      ? t('farm.categories', { categories: categories.join(', ') })
      : null,
    exports: markets.length ? t('farm.exports', { markets: markets.join(', ') }) : null,
    verified: farm.verified ? t('farm.verified') : null,
  });
  return copyMetadata(copy.title, copy.description);
}

export async function purchaseRequestPageMetadata(
  request: PurchaseRequestDetail,
  locale: string,
): Promise<Metadata> {
  if (request.status !== 'open') return {};
  const title = request.title?.trim() ?? '';
  if (!title) return {};

  const t = await getTranslations({ locale, namespace: 'seo' });
  const tc = await getTranslations({ locale, namespace: 'catalog' });
  const tp = await getTranslations({ locale, namespace: 'product' });
  const category = isProductCategory(request.category)
    ? tc(`categories.${request.category}`)
    : null;
  const unitLabel =
    request.unit && isProductUnit(request.unit) ? tp(`units.${request.unit}`) : null;
  const quantity = [request.quantity?.trim(), unitLabel].filter(Boolean).join(' ');
  const copy = requestMetadataCopy({
    title,
    category,
    destination: request.destinationCountry?.trim() || null,
    message: request.message?.trim() || null,
    fallback: t('request.fallback'),
    quantity: quantity ? t('request.quantity', { quantity }) : null,
    variety: request.variety?.trim()
      ? t('request.variety', { variety: request.variety.trim() })
      : null,
    packaging: request.packaging?.trim()
      ? t('request.packaging', { packaging: request.packaging.trim() })
      : null,
  });
  return copyMetadata(copy.title, copy.description);
}
