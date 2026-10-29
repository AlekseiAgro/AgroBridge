import { findPhoneLikeNumbers, type PhoneLikeSpan } from '@agrobridge/shared';

/** Brand suffix used on public HTML titles. The name is not translated. */
export const SEO_BRAND = 'AgroBridge';

const TITLE_SEPARATOR = ' — ';
const DEFAULT_DESCRIPTION_LENGTH = 180;

/** A contact label right before a number: "Tel.:", "WhatsApp", "Звоните", "ტელ:". */
const CONTACT_LABEL_BEFORE =
  /(?<!\p{L})(?:tel|phone|mobile|mob|call|contact|contacts|whatsapp|viber|telegram|тел|телефон|моб|звоните|контакт|контакты|ტელ|ტელეფონი|დარეკეთ|საკონტაქტო)\.?\s*[:：\-–—]?\s*$/iu;
/** Text allowed between two numbers of one contact run: "599… or 555…", "599…, +49…". */
const NUMBER_JOINER = /^[\s,;/]*(?:or|and|или|и|ან|და)?[\s,;/]*$/iu;

function mergeContactRuns(text: string, spans: PhoneLikeSpan[]): PhoneLikeSpan[] {
  const runs: PhoneLikeSpan[] = [];
  for (const span of spans) {
    const last = runs[runs.length - 1];
    if (last && NUMBER_JOINER.test(text.slice(last.end, span.start))) {
      last.end = span.end;
    } else {
      runs.push({ ...span });
    }
  }
  return runs;
}

function tidyPunctuation(value: string): string {
  return value
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:!?…])/g, '$1')
    .replace(/[,;:]+(?=[.!?…])/g, '')
    .replace(/([.!?…])(?:\s*[.,;:])+/g, '$1')
    .replace(/[,;:](?:\s*[,;:])+/g, ',')
    .replace(/^[\s,.;:—–-]+/, '')
    .replace(/[\s,;:—–-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes phone numbers (and a contact label right before them) from text
 * used in search snippets. The stored listing text is not changed.
 */
export function redactPhoneLikeNumbers(value: string): string {
  const spans = findPhoneLikeNumbers(value);
  if (spans.length === 0) return value;
  let result = value;
  for (const run of mergeContactRuns(value, spans).reverse()) {
    const label = CONTACT_LABEL_BEFORE.exec(result.slice(0, run.start));
    const start = label ? run.start - label[0].length : run.start;
    result = `${result.slice(0, start)} ${result.slice(run.end)}`;
  }
  return tidyPunctuation(result);
}

function clean(value: string | null | undefined): string {
  return redactPhoneLikeNumbers(value?.replace(/\s+/g, ' ').trim() ?? '');
}

function clip(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength - 1);
  const space = cut.lastIndexOf(' ');
  const base = (space > 60 ? cut.slice(0, space) : cut).trimEnd();
  return `${base}…`;
}

/** Joins only the parts that exist. Duplicate labels are skipped. */
export function composeSeoTitle(parts: Array<string | null | undefined>): string {
  const unique: string[] = [];
  for (const part of parts) {
    const value = clean(part);
    if (!value) continue;
    if (unique.some((existing) => existing.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      continue;
    }
    unique.push(value);
  }
  if (unique.length === 0) return SEO_BRAND;
  return `${unique.join(TITLE_SEPARATOR)} | ${SEO_BRAND}`;
}

/**
 * Prefers the public description. Adds only the first useful fact when that
 * description is short, or up to three facts when the page has no description.
 */
export function composeSeoDescription(
  primary: string | null | undefined,
  clauses: Array<string | null | undefined>,
  maxLength = DEFAULT_DESCRIPTION_LENGTH,
): string {
  const primaryText = clean(primary);
  const extras = clauses.map(clean).filter(Boolean);
  const extraLimit = primaryText ? (primaryText.length >= 110 ? 0 : 1) : 3;
  const pieces = primaryText
    ? [primaryText, ...extras.slice(0, extraLimit)]
    : extras.slice(0, extraLimit);
  return clip(pieces.join(' '), maxLength);
}

export type ProductSeoFacts = {
  title: string;
  category: string | null;
  place: string | null;
  description: string | null;
  price: string | null;
  availability: string | null;
  quantity: string | null;
  origin: string | null;
  variety: string | null;
  season: string | null;
};

/** Raw origin text, omitted when it repeats the farm or region already in the title. */
export function distinctPublicOrigin(
  origin: string | null | undefined,
  place: string | null | undefined,
): string | null {
  const value = clean(origin);
  const placeValue = clean(place);
  if (!value) return null;
  if (placeValue && value.toLocaleLowerCase() === placeValue.toLocaleLowerCase()) return null;
  return value;
}

export function productMetadataCopy(facts: ProductSeoFacts): {
  title: string;
  description: string;
} {
  const place = clean(facts.place) || null;
  const description =
    composeSeoDescription(facts.description, [
      facts.price,
      facts.availability,
      facts.quantity,
      facts.origin,
      facts.variety,
      facts.availability ? null : facts.season,
    ]) || clean(facts.title);
  return {
    title: composeSeoTitle([facts.title, facts.category, place]),
    description,
  };
}

export type FarmSeoFacts = {
  name: string;
  region: string | null;
  description: string | null;
  fallback: string;
  categories: string | null;
  exports: string | null;
  verified: string | null;
};

export function farmMetadataCopy(facts: FarmSeoFacts): { title: string; description: string } {
  const description = clean(facts.description);
  return {
    title: composeSeoTitle([facts.name, facts.region]),
    description: composeSeoDescription(description, [
      description ? null : facts.fallback,
      facts.categories,
      facts.exports,
      facts.verified,
    ]),
  };
}

export type RequestSeoFacts = {
  title: string;
  category: string | null;
  destination: string | null;
  message: string | null;
  fallback: string;
  quantity: string | null;
  variety: string | null;
  packaging: string | null;
};

export function requestMetadataCopy(facts: RequestSeoFacts): {
  title: string;
  description: string;
} {
  const message = clean(facts.message);
  return {
    title: composeSeoTitle([facts.title, facts.category, facts.destination]),
    description: composeSeoDescription(message, [
      message ? null : facts.fallback,
      facts.quantity,
      facts.variety,
      facts.packaging,
    ]),
  };
}
