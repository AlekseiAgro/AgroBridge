import { DEFAULT_LOCALE, LOCALES, type Locale } from '@agrobridge/shared';
import { BRAND_DEFINITION, OFFICIAL_SOCIAL_PROFILES } from './brand-identity';
import { PRODUCTION_WEB_ORIGIN } from './seo-robots';
import { STATIC_PUBLIC_PATHS, localizedPublicUrl } from './seo-sitemap';

export const LLMS_TXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

/** Public sections listed in /llms.txt. Each path is a real locale-prefixed page. */
const PUBLIC_SECTIONS = [
  '/catalog',
  '/buyers',
  '/sellers',
  '/how-it-works',
  '/support',
  '/legal',
  '/terms',
  '/privacy',
] as const;

const LEGAL_PATHS = ['/legal', '/terms', '/privacy'] as const;

function publicUrl(locale: Locale, path = ''): string {
  return localizedPublicUrl(locale, path);
}

/**
 * Short public index of the official AgroBridge site.
 * No database, no product or farm listings, no private routes.
 */
export function buildLlmsTxt(): string {
  const known = new Set<string>(STATIC_PUBLIC_PATHS);
  for (const path of PUBLIC_SECTIONS) {
    if (!known.has(path)) {
      throw new Error(`llms.txt path is not a public page: ${path}`);
    }
  }

  const officialWebsite = `${PRODUCTION_WEB_ORIGIN}/`;
  const homepages = LOCALES.map((locale) => publicUrl(locale));
  const pages = PUBLIC_SECTIONS.map((path) => publicUrl(DEFAULT_LOCALE, path));
  const georgianLegal = LEGAL_PATHS.map((path) => publicUrl('ka', path));

  return [
    '# AgroBridge',
    '',
    `Official website: ${officialWebsite}`,
    '',
    BRAND_DEFINITION,
    '',
    '- Operator: P/E VANO MEGVINETUKHUTSESI',
    '- Identification number: 01501157152',
    '- Location: Tbilisi, Georgia',
    '',
    `${officialWebsite} is the official AgroBridge website.`,
    '',
    'The binding legal texts are available in Georgian and English.',
    '',
    '## Official social profiles',
    '',
    ...OFFICIAL_SOCIAL_PROFILES.map((profile) => `- ${profile.name}: ${profile.url}`),
    '',
    '## Locale homepages',
    '',
    ...homepages.map((url) => `- ${url}`),
    '',
    '## Public pages',
    '',
    ...pages.map((url) => `- ${url}`),
    '',
    '## Georgian legal texts',
    '',
    ...georgianLegal.map((url) => `- ${url}`),
    '',
  ].join('\n');
}
