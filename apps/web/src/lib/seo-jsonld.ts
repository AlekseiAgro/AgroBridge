import {
  DEFAULT_LOCALE,
  isGeorgiaRegion,
  isLocale,
  isPriceCurrency,
  isProductCategory,
  isPubliclyListedProduct,
  type Locale,
  type ProductImage,
} from '@agrobridge/shared';
import { getRenderableProductImages, resolveProductImageUrl } from './product-image';
import { toPublicMediaUrl } from './public-media-url';
import { SEO_BRAND } from './seo-page-metadata';
import { PRODUCTION_WEB_ORIGIN } from './seo-robots';
import { localizedPublicUrl } from './seo-sitemap';

/** Same lockup as `BrandLogo`. Kept here so this module stays free of JSX. */
const LOGO_SRC = '/brand/agrobridge-logo.png';
const LOGO_WIDTH = 1773;
const LOGO_HEIGHT = 887;
import kaMessages from '../../messages/ka.json';
import enMessages from '../../messages/en.json';
import ruMessages from '../../messages/ru.json';
import deMessages from '../../messages/de.json';
import frMessages from '../../messages/fr.json';
import itMessages from '../../messages/it.json';
import esMessages from '../../messages/es.json';

const ORGANIZATION_ID = `${PRODUCTION_WEB_ORIGIN}/#organization`;
const WEBSITE_ID = `${PRODUCTION_WEB_ORIGIN}/#website`;
/** Official site origin. The same Organization node is published on every locale homepage. */
const ORGANIZATION_URL = `${PRODUCTION_WEB_ORIGIN}/`;
/**
 * Operator facts from `content/legal/information.en.ts`.
 * legalName is the individual entrepreneur who operates the marketplace, not a company name.
 */
const ORGANIZATION_LEGAL_NAME = 'P/E VANO MEGVINETUKHUTSESI';
const ORGANIZATION_EMAIL = 'Support@agrobridge.ge';
const ORGANIZATION_DESCRIPTION =
  'AgroBridge is a Georgian B2B agricultural marketplace connecting Georgian farms and agricultural producers with buyers in Georgia and international markets.';

const CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  ka: kaMessages.catalog.categories,
  en: enMessages.catalog.categories,
  ru: ruMessages.catalog.categories,
  de: deMessages.catalog.categories,
  fr: frMessages.catalog.categories,
  it: itMessages.catalog.categories,
  es: esMessages.catalog.categories,
};

const REGION_LABELS: Record<Locale, Record<string, string>> = {
  ka: kaMessages.regions,
  en: enMessages.regions,
  ru: ruMessages.regions,
  de: deMessages.regions,
  fr: frMessages.regions,
  it: itMessages.regions,
  es: esMessages.regions,
};

export type HomeJsonLdInput = {
  locale: string;
  description: string;
  slogan: string;
};

export type ProductJsonLdSource = {
  id: string;
  title?: string | null;
  description?: string | null;
  display?: { title?: string | null; description?: string | null } | null;
  category?: string | null;
  country?: string | null;
  images?: ProductImage[] | null;
  isPublished?: boolean | null;
  moderationStatus?: string | null;
  priceFrom?: number | null;
  priceCurrency?: string | null;
  priceNegotiable?: boolean | null;
  priceDependsOnVolume?: boolean | null;
  harvestStatus?: string | null;
  preorderEnabled?: boolean | null;
  farm?: { id: string } | null;
};

export type FarmJsonLdSource = {
  id: string;
  name?: string | null;
  description?: string | null;
  display?: { description?: string | null } | null;
  region?: string | null;
  foundedYear?: number | null;
  companyRegistryName?: string | null;
  photos?: Array<{ url?: string | null; sortOrder?: number | null }> | null;
};

type JsonLdNode = Record<string, unknown>;

function absoluteProductImageUrl(url: string): string | null {
  const resolved = resolveProductImageUrl(url);
  if (!resolved) return null;
  if (/^https?:\/\//i.test(resolved)) return resolved;
  if (resolved.startsWith('/') && !resolved.startsWith('//')) {
    return `${PRODUCTION_WEB_ORIGIN}${resolved}`;
  }
  return null;
}

function productImages(images: ProductImage[] | null | undefined): string[] {
  const urls: string[] = [];
  for (const image of getRenderableProductImages(images)) {
    const absolute = absoluteProductImageUrl(image.url);
    if (!absolute || urls.includes(absolute)) continue;
    urls.push(absolute);
  }
  return urls;
}

function categoryLabel(category: string | null | undefined, locale: Locale): string | null {
  if (!category || !isProductCategory(category)) return null;
  const label = CATEGORY_LABELS[locale][category]?.trim() ?? '';
  return label || null;
}

function regionLabel(region: string | null | undefined, locale: Locale): string | null {
  if (!region || !isGeorgiaRegion(region)) return null;
  const label = REGION_LABELS[locale][region]?.trim() ?? '';
  return label || null;
}

/** Stable English farm entity. Product offers and the farm page must share this @id. */
export function farmOrganizationId(farmId: string): string {
  return `${localizedPublicUrl(DEFAULT_LOCALE, `/farms/${farmId.trim()}`)}#organization`;
}

function absoluteFarmPhotoUrl(url: string): string | null {
  const resolved = toPublicMediaUrl(url.trim());
  if (!resolved) return null;
  if (/^https?:\/\//i.test(resolved)) return resolved;
  if (resolved.startsWith('/') && !resolved.startsWith('//')) {
    return `${PRODUCTION_WEB_ORIGIN}${resolved}`;
  }
  return null;
}

function farmPhotoUrls(
  photos: FarmJsonLdSource['photos'],
): string[] {
  if (!photos?.length) return [];
  const ordered = photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => (a.photo.sortOrder ?? 0) - (b.photo.sortOrder ?? 0) || a.index - b.index);
  const urls: string[] = [];
  for (const { photo } of ordered) {
    if (typeof photo.url !== 'string') continue;
    const absolute = absoluteFarmPhotoUrl(photo.url);
    if (!absolute || urls.includes(absolute)) continue;
    urls.push(absolute);
  }
  return urls;
}

/**
 * Offer only for a finite public starting price in GEL, EUR, or USD
 * that is neither negotiable nor volume-dependent.
 */
function publicOfferPrice(product: ProductJsonLdSource): { price: number; priceCurrency: string } | null {
  const price = product.priceFrom;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const priceCurrency = product.priceCurrency?.trim() ?? '';
  if (!isPriceCurrency(priceCurrency)) return null;
  if (product.priceNegotiable !== false || product.priceDependsOnVolume !== false) return null;
  return { price, priceCurrency };
}

/** Harvest status only. Stock quantity is not availability. */
function offerAvailability(product: ProductJsonLdSource): string | null {
  switch (product.harvestStatus) {
    case 'available':
      return 'https://schema.org/InStock';
    case 'limited':
      return 'https://schema.org/LimitedAvailability';
    case 'soldOut':
      return 'https://schema.org/SoldOut';
    case 'growing':
      return product.preorderEnabled === true ? 'https://schema.org/PreOrder' : null;
    default:
      return null;
  }
}

function productOffer(product: ProductJsonLdSource, locale: Locale, productId: string): JsonLdNode | null {
  const price = publicOfferPrice(product);
  if (!price) return null;

  const offer: JsonLdNode = {
    '@type': 'Offer',
    price: price.price,
    priceCurrency: price.priceCurrency,
    url: localizedPublicUrl(locale, `/products/${productId}`),
  };
  const availability = offerAvailability(product);
  if (availability) offer.availability = availability;

  const farmId = product.farm?.id?.trim() ?? '';
  if (farmId) {
    offer.seller = { '@id': farmOrganizationId(farmId) };
  }
  return offer;
}

export function buildHomeJsonLd(input: HomeJsonLdInput): JsonLdNode | null {
  if (!isLocale(input.locale)) return null;

  const website: JsonLdNode = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SEO_BRAND,
    url: localizedPublicUrl(input.locale),
    inLanguage: input.locale,
    publisher: { '@id': ORGANIZATION_ID },
  };
  const description = input.description.trim();
  if (description) website.description = description;

  const organization: JsonLdNode = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SEO_BRAND,
    legalName: ORGANIZATION_LEGAL_NAME,
    url: ORGANIZATION_URL,
    description: ORGANIZATION_DESCRIPTION,
    email: ORGANIZATION_EMAIL,
    identifier: {
      '@type': 'PropertyValue',
      name: 'Identification Number',
      value: '01501157152',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Adam Mitskevichi St. 29/5',
      addressLocality: 'Tbilisi',
      addressCountry: 'GE',
    },
    areaServed: [
      { '@type': 'Country', name: 'Georgia' },
      { '@type': 'Place', name: 'International markets' },
    ],
    logo: {
      '@type': 'ImageObject',
      url: `${PRODUCTION_WEB_ORIGIN}${LOGO_SRC}`,
      width: LOGO_WIDTH,
      height: LOGO_HEIGHT,
    },
  };
  const slogan = input.slogan.trim();
  if (slogan) organization.slogan = slogan;

  const webpage = webpageNode({
    locale: input.locale,
    path: '',
    aboutId: ORGANIZATION_ID,
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [website, organization, webpage],
  };
}

export function buildProductJsonLd(
  product: ProductJsonLdSource,
  locale: string,
): JsonLdNode | null {
  if (!isLocale(locale)) return null;
  if (!isPubliclyListedProduct(product)) return null;

  const name = (product.display?.title?.trim() || product.title || '').trim();
  const id = product.id.trim();
  if (!name || !id) return null;

  const data: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${localizedPublicUrl(DEFAULT_LOCALE, `/products/${id}`)}#product`,
    url: localizedPublicUrl(locale, `/products/${id}`),
    name,
  };

  const description = (product.display?.description?.trim() || product.description || '').trim();
  if (description) data.description = description;

  const images = productImages(product.images);
  if (images.length > 0) data.image = images;

  const category = categoryLabel(product.category, locale);
  if (category) data.category = category;

  const country = product.country?.trim() ?? '';
  if (country) {
    data.countryOfOrigin = {
      '@type': 'Country',
      name: country,
    };
  }

  const offer = productOffer(product, locale, id);
  if (offer) data.offers = offer;

  return data;
}

export function buildFarmJsonLd(farm: FarmJsonLdSource, locale: string): JsonLdNode | null {
  if (!isLocale(locale)) return null;
  const id = farm.id.trim();
  const name = farm.name?.trim() ?? '';
  if (!id || !name) return null;

  const data: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': farmOrganizationId(id),
    url: localizedPublicUrl(locale, `/farms/${id}`),
    name,
  };

  const description = (farm.display?.description?.trim() || farm.description || '').trim();
  if (description) data.description = description;

  const images = farmPhotoUrls(farm.photos);
  if (images.length > 0) data.image = images;

  const year = farm.foundedYear;
  if (typeof year === 'number' && Number.isInteger(year) && year >= 1800 && year <= 2200) {
    data.foundingDate = String(year);
  }

  const legalName = farm.companyRegistryName?.trim() ?? '';
  if (legalName) data.legalName = legalName;

  const region = regionLabel(farm.region, locale);
  if (region) {
    data.address = {
      '@type': 'PostalAddress',
      addressRegion: region,
      addressCountry: 'GE',
    };
  }

  return data;
}

export type BreadcrumbJsonLdItem = {
  name: string;
  path: string;
};

function isBreadcrumbPath(path: string): boolean {
  if (path === '') return true;
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  return !path.includes('?') && !path.includes('#');
}

/**
 * Standalone BreadcrumbList. `@id` stays on the English URL.
 * Item URLs use the current locale. Blank names and query paths are omitted.
 */
export function buildBreadcrumbJsonLd(input: {
  locale: string;
  idPath: string;
  items: BreadcrumbJsonLdItem[];
}): JsonLdNode | null {
  if (!isLocale(input.locale)) return null;
  if (input.idPath === '' || !isBreadcrumbPath(input.idPath)) return null;
  if (input.items.length < 2) return null;

  const itemListElement: JsonLdNode[] = [];
  for (const [index, item] of input.items.entries()) {
    const name = item.name.trim();
    if (!name || !isBreadcrumbPath(item.path)) return null;
    itemListElement.push({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: localizedPublicUrl(input.locale, item.path),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${localizedPublicUrl(DEFAULT_LOCALE, input.idPath)}#breadcrumb`,
    itemListElement,
  };
}

/**
 * Locale page node. It only references existing entity ids.
 * Product, farm, website, and organization nodes stay in their own builders.
 */
function webpageNode(input: {
  locale: Locale;
  path: string;
  aboutId?: string;
  mainEntityId?: string;
  breadcrumbId?: string;
}): JsonLdNode {
  const url = localizedPublicUrl(input.locale, input.path);
  const page: JsonLdNode = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    inLanguage: input.locale,
    isPartOf: { '@id': WEBSITE_ID },
  };
  if (input.mainEntityId) page.mainEntity = { '@id': input.mainEntityId };
  if (input.breadcrumbId) page.breadcrumb = { '@id': input.breadcrumbId };
  if (input.aboutId) page.about = { '@id': input.aboutId };
  return page;
}

function withoutContext(node: JsonLdNode): JsonLdNode {
  const rest = { ...node };
  delete rest['@context'];
  return rest;
}

function linkedGraph(nodes: JsonLdNode[]): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.map(withoutContext),
  };
}

function breadcrumbIdOf(breadcrumb: JsonLdNode | null): string {
  if (!breadcrumb || breadcrumb['@type'] !== 'BreadcrumbList') return '';
  return typeof breadcrumb['@id'] === 'string' ? breadcrumb['@id'] : '';
}

/** One graph: the existing Product node, its breadcrumb, and a WebPage that only links them. */
export function buildProductPageJsonLd(
  product: ProductJsonLdSource,
  locale: string,
  breadcrumb: JsonLdNode | null,
): JsonLdNode | null {
  const entity = buildProductJsonLd(product, locale);
  if (!entity || !isLocale(locale)) return null;

  const productId = typeof entity['@id'] === 'string' ? entity['@id'] : '';
  if (!productId) return null;
  const breadcrumbId = breadcrumbIdOf(breadcrumb);
  const farmId = product.farm?.id?.trim() ?? '';
  const webpage = webpageNode({
    locale,
    path: `/products/${product.id.trim()}`,
    mainEntityId: productId,
    ...(breadcrumbId ? { breadcrumbId } : {}),
    ...(farmId ? { aboutId: farmOrganizationId(farmId) } : {}),
  });
  const nodes = [entity];
  if (breadcrumbId && breadcrumb) nodes.push(breadcrumb);
  nodes.push(webpage);
  return linkedGraph(nodes);
}

/** One graph: the existing farm Organization, its breadcrumb, and a WebPage that only links them. */
export function buildFarmPageJsonLd(
  farm: FarmJsonLdSource,
  locale: string,
  breadcrumb: JsonLdNode | null,
): JsonLdNode | null {
  const entity = buildFarmJsonLd(farm, locale);
  if (!entity || !isLocale(locale)) return null;

  const organizationId = typeof entity['@id'] === 'string' ? entity['@id'] : '';
  if (!organizationId) return null;
  const breadcrumbId = breadcrumbIdOf(breadcrumb);
  const webpage = webpageNode({
    locale,
    path: `/farms/${farm.id.trim()}`,
    mainEntityId: organizationId,
    ...(breadcrumbId ? { breadcrumbId } : {}),
  });
  const nodes = [entity];
  if (breadcrumbId && breadcrumb) nodes.push(breadcrumb);
  nodes.push(webpage);
  return linkedGraph(nodes);
}
