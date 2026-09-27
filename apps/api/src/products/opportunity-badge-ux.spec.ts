import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MARKET_OPPORTUNITY_TIERS,
  evaluateMarketOpportunity,
} from '@agrobridge/shared';

const WEB = join(__dirname, '../../../web');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const TIERS = ['excellent', 'good', 'fair', 'watch'] as const;
const I18N_KEYS = [
  'opportunity.helpMark',
  'opportunity.tiers.excellent',
  'opportunity.tiers.good',
  'opportunity.tiers.fair',
  'opportunity.tiers.watch',
  'opportunity.tooltip.whatItMeans',
  'opportunity.tooltip.whyItMatters',
  'opportunity.tooltip.signalBasis',
] as const;

type Nested = Record<string, unknown>;

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

function source(rel: string): string {
  return readFileSync(join(WEB, 'src', rel), 'utf8');
}

function css(): string {
  return readFileSync(join(WEB, 'src/app/globals.css'), 'utf8');
}

describe('opportunity badge UX', () => {
  const badge = source('components/MarketOpportunityBadge.tsx');
  const styles = css();

  it('keeps the audited listing-heuristic algorithm unchanged', () => {
    expect(MARKET_OPPORTUNITY_TIERS).toEqual(['excellent', 'good', 'fair', 'watch']);
    expect(
      evaluateMarketOpportunity({
        id: 'berry-1',
        category: 'berries',
        harvestStartAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        harvestStatus: 'limited',
        preorderEnabled: true,
        exportMarkets: ['Germany', 'Netherlands'],
      }).tier,
    ).toBe('excellent');
    expect(
      evaluateMarketOpportunity({
        id: 'honey-1',
        category: 'honey',
        harvestStatus: 'available',
        exportMarkets: ['France'],
      }).tier,
    ).toBe('watch');
    expect(badge).not.toContain('score >=');
    expect(badge).not.toContain('evaluateMarketOpportunity(');
  });

  it('renders a distinct label, meter, and help tooltip for every existing tier', () => {
    expect(badge).toContain('TIER_BARS');
    expect(badge).toContain('excellent: 4');
    expect(badge).toContain('good: 3');
    expect(badge).toContain('fair: 2');
    expect(badge).toContain('watch: 1');
    expect(badge).toContain("t(`tiers.${opportunity.tier}`)");
    expect(badge).toContain("t('tooltip.whatItMeans')");
    expect(badge).toContain("t('tooltip.whyItMatters')");
    expect(badge).toContain("t('helpMark')");
    expect(badge).toContain('opportunity-badge__meter');
    expect(badge).toContain('opportunity-badge__help');
    expect(badge).toContain('role="tooltip"');
    expect(badge).toContain('aria-label');
    for (const tier of TIERS) {
      expect(styles).toContain(`.opportunity-badge--${tier}`);
    }
    expect(styles).toContain('opportunity-badge__bar--on');
    expect(styles).toContain('border-style: dashed');
    expect(styles).toContain('border-style: dotted');
    expect(styles).toContain('border-width: 1.5px');
  });

  it('does not hide a missing-signal state because every listing already receives a tier', () => {
    expect(badge).not.toContain("kind === 'none'");
    expect(badge).not.toContain('opportunity.tier ?');
    expect(source('app/[locale]/catalog/page.tsx')).toContain('MarketOpportunityBadge');
    expect(source('app/[locale]/products/[id]/page.tsx')).toContain('MarketOpportunityBadge');
  });

  it('does not change catalog ranking or invent live demand copy', () => {
    const catalog = source('app/[locale]/catalog/page.tsx');
    expect(catalog).not.toContain('orderBy: opportunity');
    expect(catalog).not.toContain('sort=opportunity');
    expect(badge).not.toContain('highDemand');
    expect(badge).not.toContain('priceRiseLikely');
    expect(badge).not.toContain('priceDeltaPercent');
  });
});

describe('opportunity badge i18n', () => {
  it.each(LOCALES)('%s has distinct market-opportunity labels and explanations', (locale) => {
    const data = messages(locale);
    const labels = TIERS.map((tier) => read(data, `opportunity.tiers.${tier}`));
    expect(new Set(labels).size).toBe(TIERS.length);
    for (const key of I18N_KEYS) {
      expect(read(data, key).trim().length).toBeGreaterThan(0);
    }
    expect(read(data, 'opportunity.tooltip.whatItMeans').toLowerCase()).not.toMatch(
      /live market statistics|историческ|статистик/i,
    );
  });

  it.each(['ka', 'ru', 'de', 'fr', 'it', 'es'] as const)(
    '%s does not leave opportunity copy in English',
    (locale) => {
      const data = messages(locale);
      const en = messages('en');
      const leftover: string[] = [];
      for (const key of I18N_KEYS) {
        if (key === 'opportunity.helpMark') continue;
        if (read(data, key) === read(en, key)) leftover.push(key);
      }
      expect(leftover).toEqual([]);
    },
  );

  it('stops using the abstract opportunity-signal phrase in visible labels', () => {
    const en = messages('en');
    const ru = messages('ru');
    expect(read(en, 'opportunity.tiers.excellent')).toBe('High market opportunity');
    expect(read(en, 'opportunity.tiers.good')).toBe('Good market opportunity');
    expect(read(en, 'opportunity.tiers.fair')).toBe('Moderate market opportunity');
    expect(read(en, 'opportunity.tiers.watch')).toBe('Low market opportunity');
    expect(read(ru, 'opportunity.tiers.excellent')).toBe('Высокая рыночная возможность');
    expect(read(ru, 'opportunity.tiers.good')).toBe('Хорошая рыночная возможность');
    expect(JSON.stringify(en)).not.toContain('Opportunity signal');
    expect(JSON.stringify(ru)).not.toContain('Сигнал возможности');
  });
});
