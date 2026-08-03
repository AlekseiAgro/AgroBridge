import { catalogSearchCanonicalMatches } from '@agrobridge/shared';

describe('catalogSearchCanonicalMatches', () => {
  it('matches localized Russian product titles back to English keys', () => {
    const { titles } = catalogSearchCanonicalMatches('персик');
    expect(titles).toContain('Fresh Kakheti peaches');
  });

  it('matches English title fragments', () => {
    const { titles } = catalogSearchCanonicalMatches('peach');
    expect(titles).toContain('Fresh Kakheti peaches');
  });

  it('treats ё and е as equivalent for Russian honey search', () => {
    expect(catalogSearchCanonicalMatches('мёд').titles.length).toBeGreaterThan(0);
    expect(catalogSearchCanonicalMatches('мед').titles.length).toBeGreaterThan(0);
  });

  it('matches localized descriptions', () => {
    const { descriptions } = catalogSearchCanonicalMatches('свободной косточки');
    expect(descriptions).toContain(
      'Seasonal freestone peaches, hand-picked for export.',
    );
  });

  it('returns empty arrays for blank queries', () => {
    expect(catalogSearchCanonicalMatches('   ')).toEqual({
      titles: [],
      descriptions: [],
    });
  });
});
