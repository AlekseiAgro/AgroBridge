import { readFileSync } from 'fs';
import { join } from 'path';
import { LOCALES } from '@agrobridge/shared';
import {
  BRAND_ALTERNATE_NAME,
  BRAND_DEFINITION,
  OFFICIAL_SOCIAL_PROFILES,
  OFFICIAL_SOCIAL_PROFILE_URLS,
} from '../../../web/src/lib/brand-identity';

const WEB = join(__dirname, '../../../web');

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') throw new Error(`Missing string ${path}`);
  return value;
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

function source(path: string): string {
  return readFileSync(join(WEB, 'src', path), 'utf8');
}

const ENGLISH: Record<string, string> = {
  'home.headline': 'Georgian farms. Global buyers.',
  'home.platform': 'Global B2B platform for agricultural trade',
  'home.subtitle':
    'Discover Georgian producers, explore agricultural products, publish purchase requests and exchange offers with buyers and suppliers in Georgia and international markets.',
  'home.marketplaceTitle': 'A connected platform for agricultural trade',
  'home.marketplaceBody':
    'AgroBridge brings agricultural producers and buyers together through product discovery, purchase requests and direct B2B communication — helping both sides find relevant trading opportunities in one place.',
  'howItWorks.eyebrow': 'Direct trade',
  'howItWorks.title': 'A simpler trade process',
  'howItWorks.steps.connect.text':
    'Buyers publish purchase requests or ask for quotes on catalog products. Suppliers reply with offers, and both sides communicate directly on the platform.',
  'footer.followUs': 'Follow us',
  'footer.opensInNewTab': 'opens in a new tab',
};

const LOCALIZED_KEYS = Object.keys(ENGLISH).filter((key) => key !== 'home.headline');

const UNSUPPORTED_CLAIMS =
  /payment|escrow|deliver|logistic|shipping|guarantee|largest|leading|number one|world'?s|every country/i;

describe('brand positioning copy', () => {
  it('uses the approved English homepage and How it works copy', () => {
    const en = messages('en');
    for (const [key, value] of Object.entries(ENGLISH)) {
      expect(read(en, key)).toBe(value);
    }
  });

  it.each(LOCALES.filter((locale) => locale !== 'en'))(
    '%s translates every changed key',
    (locale) => {
      const data = messages(locale);
      const en = messages('en');
      for (const key of LOCALIZED_KEYS) {
        const value = read(data, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(read(en, key));
      }
    },
  );

  it.each(LOCALES)(
    '%s homepage category and intro heading do not call the brand a marketplace',
    (locale) => {
      const data = messages(locale);
      for (const key of ['home.platform', 'home.marketplaceTitle', 'home.marketplaceBody']) {
        expect(read(data, key).toLowerCase()).not.toMatch(
          /marketplace|marktplatz|place de marché|mercado agrícola|маркетплейс|მარკეტ/,
        );
      }
    },
  );

  it('keeps English homepage and How it works copy free of unsupported service claims', () => {
    const en = messages('en');
    const copy = [...strings(en.home), ...strings(en.howItWorks)].join('\n');
    expect(copy).not.toMatch(UNSUPPORTED_CLAIMS);
    expect(copy).not.toMatch(/cabinet/i);
    expect(BRAND_DEFINITION).not.toMatch(UNSUPPORTED_CLAIMS);
  });

  it('uses the informal Italian form across all How it works steps', () => {
    const it = messages('it');
    expect(read(it, 'howItWorks.steps.agree.title')).toBe('Concorda i termini di fornitura');
    expect(read(it, 'howItWorks.steps.agree.text')).toBe(
      'Valuta prezzo, quantità e tempi, accetta un’offerta e continua il coordinamento in un unico spazio.',
    );
    expect(JSON.stringify(it.howItWorks)).not.toMatch(
      /Concordate|Valutate|accettate|continuate|chattono/,
    );
  });
});

describe('official social profiles', () => {
  it('exposes the canonical brand identity', () => {
    expect(BRAND_ALTERNATE_NAME).toBe('AgroBridge Georgia');
    expect(BRAND_DEFINITION).toBe(
      'AgroBridge is a global B2B platform for agricultural trade, connecting Georgian producers with buyers in Georgia and international markets. Users can discover agricultural products, publish purchase requests, exchange offers and communicate directly.',
    );
    expect(OFFICIAL_SOCIAL_PROFILES).toEqual([
      { name: 'Instagram', url: 'https://www.instagram.com/agrobridge.ge/' },
      {
        name: 'Facebook',
        url: 'https://www.facebook.com/people/AgroBridge-Georgia/61594968249897/',
      },
    ]);
    expect(OFFICIAL_SOCIAL_PROFILE_URLS).toEqual(OFFICIAL_SOCIAL_PROFILES.map((p) => p.url));
    for (const url of OFFICIAL_SOCIAL_PROFILE_URLS) {
      const parsed = new URL(url);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.search).toBe('');
      expect(parsed.hash).toBe('');
    }
  });

  it('keeps the profile URLs in one shared module', () => {
    for (const path of ['components/SiteFooter.tsx', 'lib/seo-jsonld.ts', 'lib/llms-txt.ts']) {
      const file = source(path);
      expect(file).not.toContain('instagram.com');
      expect(file).not.toContain('facebook.com');
      expect(file).toMatch(/from '(@\/lib|\.)\/brand-identity'/);
    }
  });

  it('adds accessible external links in a labelled footer column', () => {
    const footer = source('components/SiteFooter.tsx');
    expect(footer).toContain(`<nav className="site-footer__col" aria-label={t('followUs')}>`);
    expect(footer).toContain(`<p className="site-footer__heading">{t('followUs')}</p>`);
    expect(footer).toContain('OFFICIAL_SOCIAL_PROFILES.map((profile) =>');
    expect(footer).toContain('href={profile.url} target="_blank" rel="noopener noreferrer"');
    expect(footer).toContain('{profile.name}');
    expect(footer).toContain(`<span className="sr-only"> ({t('opensInNewTab')})</span>`);
    expect(source('app/globals.css')).toMatch(/\.sr-only\s*\{/);

    for (const href of ['href="/legal"', 'href="/terms"', 'href="/privacy"', 'href="/buyers"']) {
      expect(footer).toContain(href);
    }
  });
});
