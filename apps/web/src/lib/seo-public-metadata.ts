import {
  formatListedPrice,
  isLocale,
  isProductCategory,
  isProductUnit,
  isPubliclyListedProduct,
  type FarmDetail,
  type Locale,
  type ProductDetail,
  type PurchaseRequestDetail,
} from '@agrobridge/shared';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRenderableProductImages, toPublicMediaUrl } from './product-image';
import { formatProductQuantityRange } from './product-quantity';
import { formatRegionLabel } from './region';
import {
  farmMetadataCopy,
  distinctPublicOrigin,
  productMetadataCopy,
  requestMetadataCopy,
} from './seo-page-metadata';
import { PRODUCTION_WEB_ORIGIN } from './seo-robots';
import { localizedPublicUrl } from './seo-sitemap';

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

const STATIC_PAGE_PATH: Record<StaticSeoPage, string> = {
  home: '',
  catalog: '/catalog',
  requests: '/requests',
  buyers: '/buyers',
  sellers: '/sellers',
  howItWorks: '/how-it-works',
  support: '/support',
  legal: '/legal',
  terms: '/terms',
  privacy: '/privacy',
};

/** Existing public lockup. Not a generated social card. */
const BRAND_LOGO_URL = `${PRODUCTION_WEB_ORIGIN}/brand/agrobridge-logo.png`;
const BRAND_LOGO_WIDTH = 1773;
const BRAND_LOGO_HEIGHT = 887;
const BRAND_ALT = 'AgroBridge';

type PublicOgImage = {
  url: string;
  alt: string;
  width?: number;
  height?: number;
};

function copyMetadata(title: string, description: string): Metadata {
  const metadata: Metadata = {};
  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  if (cleanTitle) metadata.title = cleanTitle;
  if (cleanDescription) metadata.description = cleanDescription;
  return metadata;
}

function absolutePublicMediaUrl(url: string): string | null {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return `${PRODUCTION_WEB_ORIGIN}${url}`;
  return null;
}

function brandOpenGraphImage(alt: string): PublicOgImage {
  return {
    url: BRAND_LOGO_URL,
    alt,
    width: BRAND_LOGO_WIDTH,
    height: BRAND_LOGO_HEIGHT,
  };
}

function firstAbsoluteUrl(urls: string[]): string | null {
  for (const url of urls) {
    const absolute = absolutePublicMediaUrl(url);
    if (absolute) return absolute;
  }
  return null;
}

function productOpenGraphImages(product: ProductDetail, alt: string): PublicOgImage[] {
  const photo = firstAbsoluteUrl(getRenderableProductImages(product.images).map((image) => image.url));
  if (!photo) return [brandOpenGraphImage(alt)];
  return [{ url: photo, alt }];
}

function farmOpenGraphImages(farm: FarmDetail, alt: string): PublicOgImage[] {
  const urls: string[] = [];
  for (const photo of farm.photos) {
    if (typeof photo?.url !== 'string') continue;
    const resolved = toPublicMediaUrl(photo.url.trim());
    if (resolved) urls.push(resolved);
  }
  const photo = firstAbsoluteUrl(urls);
  if (!photo) return [brandOpenGraphImage(alt)];
  return [{ url: photo, alt }];
}

function publicMetadata(
  title: string,
  description: string,
  locale: string,
  path: string,
  images: PublicOgImage[],
): Metadata {
  const metadata = copyMetadata(title, description);
  if (!metadata.title || !isLocale(locale)) return metadata;
  return {
    ...metadata,
    openGraph: {
      title: metadata.title,
      ...(metadata.description ? { description: metadata.description } : {}),
      url: localizedPublicUrl(locale as Locale, path),
      type: 'website',
      images,
    },
  };
}

export async function staticPublicMetadata(locale: string, page: StaticSeoPage): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  return publicMetadata(
    t(`${page}.title`),
    t(`${page}.description`),
    locale,
    STATIC_PAGE_PATH[page],
    [brandOpenGraphImage(BRAND_ALT)],
  );
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

  const title = product.display?.title?.trim() || product.title;
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
    description: product.display?.description?.trim() || product.description?.trim() || null,
    price: price ? t('product.price', { price }) : null,
    availability: availability ? t('product.availability', { status: availability }) : null,
    quantity: quantity ? t('product.quantity', { quantity }) : null,
    origin: originValue ? t('product.origin', { origin: originValue }) : null,
    variety: (product.display?.variety || product.variety)?.trim()
      ? t('product.variety', {
          variety: (product.display?.variety || product.variety)?.trim() ?? '',
        })
      : null,
    season: season ? t('product.season', { months: season }) : null,
  });
  return publicMetadata(
    copy.title,
    copy.description,
    locale,
    `/products/${product.id}`,
    productOpenGraphImages(product, title),
  );
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
    description: farm.display?.description?.trim() || farm.description?.trim() || null,
    fallback: t('farm.fallback', { name }),
    categories: categories.length
      ? t('farm.categories', { categories: categories.join(', ') })
      : null,
    exports: markets.length ? t('farm.exports', { markets: markets.join(', ') }) : null,
    verified: farm.verified ? t('farm.verified') : null,
  });
  return publicMetadata(
    copy.title,
    copy.description,
    locale,
    `/farms/${farm.id}`,
    farmOpenGraphImages(farm, name),
  );
}

export async function purchaseRequestPageMetadata(
  request: PurchaseRequestDetail,
  locale: string,
): Promise<Metadata> {
  if (request.status !== 'open') return {};
  const title = request.display?.title?.trim() || request.title?.trim() || '';
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
  return publicMetadata(
    copy.title,
    copy.description,
    locale,
    `/requests/${request.id}`,
    [brandOpenGraphImage(title)],
  );
}
