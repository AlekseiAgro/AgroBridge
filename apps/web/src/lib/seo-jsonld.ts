import {
  DEFAULT_LOCALE,
  isLocale,
  isProductCategory,
  isPubliclyListedProduct,
  type Locale,
  type ProductImage,
} from '@agrobridge/shared';
import { getRenderableProductImages, resolveProductImageUrl } from './product-image';
import { formatProductDescription, formatProductTitle } from './product-title';
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

const CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  ka: kaMessages.catalog.categories,
  en: enMessages.catalog.categories,
  ru: ruMessages.catalog.categories,
  de: deMessages.catalog.categories,
  fr: frMessages.catalog.categories,
  it: itMessages.catalog.categories,
  es: esMessages.catalog.categories,
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
  category?: string | null;
  country?: string | null;
  images?: ProductImage[] | null;
  isPublished?: boolean | null;
  moderationStatus?: string | null;
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
    url: localizedPublicUrl(DEFAULT_LOCALE),
    logo: {
      '@type': 'ImageObject',
      url: `${PRODUCTION_WEB_ORIGIN}${LOGO_SRC}`,
      width: LOGO_WIDTH,
      height: LOGO_HEIGHT,
    },
  };
  const slogan = input.slogan.trim();
  if (slogan) organization.slogan = slogan;

  return {
    '@context': 'https://schema.org',
    '@graph': [website, organization],
  };
}

export function buildProductJsonLd(
  product: ProductJsonLdSource,
  locale: string,
): JsonLdNode | null {
  if (!isLocale(locale)) return null;
  if (!isPubliclyListedProduct(product)) return null;

  const name = formatProductTitle(product.title, locale).trim();
  const id = product.id.trim();
  if (!name || !id) return null;

  const data: JsonLdNode = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${localizedPublicUrl(DEFAULT_LOCALE, `/products/${id}`)}#product`,
    url: localizedPublicUrl(locale, `/products/${id}`),
    name,
  };

  const description = formatProductDescription(product.description, locale).trim();
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

  return data;
}
