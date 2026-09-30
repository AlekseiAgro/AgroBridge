import {
  catalogTextMatches,
  completedTranslationSearchParts,
  normalizeCatalogSearchText,
  presentCatalogText,
  presentFarmText,
  presentPurchaseRequestText,
  publicationBlockedForMissingPhoto,
} from '@agrobridge/shared';

const grape = {
  title: 'ყურძენი',
  description: null,
  variety: null,
  originPlace: null,
  sourceLocale: 'ka',
  translations: [
    { locale: 'ru', status: 'completed', title: 'виноград' },
    { locale: 'en', status: 'completed', title: 'grapes' },
    { locale: 'de', status: 'completed', title: 'Trauben' },
    { locale: 'fr', status: 'completed', title: 'raisin' },
  ],
};

function grapeMatches(query: string): boolean {
  return catalogTextMatches(query, [
    grape.title,
    grape.description,
    grape.variety,
    grape.originPlace,
    ...completedTranslationSearchParts(grape.translations),
  ]);
}

describe('multilingual catalog text', () => {
  it('finds one product from every completed translation and the original title', () => {
    for (const query of ['виноград', 'grapes', 'Trauben', 'raisin', 'ყურძენი']) {
      expect(grapeMatches(query)).toBe(true);
    }
  });

  it('keeps the stored original title', () => {
    expect(grape.title).toBe('ყურძენი');
    expect(presentCatalogText(grape, 'ru').source.title).toBe('ყურძენი');
    expect(presentCatalogText(grape, 'ru').source.locale).toBe('ka');
  });

  it('shows the original variety and ignores a stored translation of it', () => {
    const product = {
      ...grape,
      variety: 'Киси',
      translations: [
        {
          locale: 'ru',
          status: 'completed',
          title: 'виноград',
          variety: 'Кислый хихви',
          description: 'описание',
        },
      ],
    };
    const text = presentCatalogText(product, 'ru');
    expect(text.source.variety).toBe('Киси');
    expect(text.display.variety).toBe('Киси');
    expect(text.display.title).toBe('виноград');
    expect(text.display.description).toBe('описание');
    expect(product.variety).toBe('Киси');
    expect(
      catalogTextMatches('Киси', [
        product.variety,
        ...completedTranslationSearchParts(product.translations),
      ]),
    ).toBe(true);
    expect(
      catalogTextMatches('Кислый хихви', [
        product.variety,
        ...completedTranslationSearchParts(product.translations),
      ]),
    ).toBe(false);
    expect(catalogTextMatches('виноград', [...completedTranslationSearchParts(product.translations)])).toBe(
      true,
    );
  });

  it('returns the Russian display title', () => {
    const text = presentCatalogText(grape, 'ru');
    expect(text.display.locale).toBe('ru');
    expect(text.display.title).toBe('виноград');
    expect(text.display.translationStatus).toBe('completed');
  });

  it('returns the English display title', () => {
    const text = presentCatalogText(grape, 'en');
    expect(text.display.locale).toBe('en');
    expect(text.display.title).toBe('grapes');
  });

  it('falls back to the original text when a translation is missing', () => {
    const text = presentCatalogText(grape, 'it');
    expect(text.display.title).toBe('ყურძენი');
    expect(text.display.translationStatus).toBe('pending');
    expect(text.source.title).toBe('ყურძენი');
  });

  it('folds мед, мёд, МЕД, and МЁД onto the same search key', () => {
    const stored = 'Гречишный мёд';
    for (const query of ['мед', 'мёд', 'МЕД', 'МЁД']) {
      expect(normalizeCatalogSearchText(query)).toBe('мед');
      expect(catalogTextMatches(query, [stored])).toBe(true);
    }
    expect(normalizeCatalogSearchText('  МЁД  ')).toBe('мед');
  });

  it('searches purchase requests across completed translations and the original', () => {
    const request = {
      title: 'ყურძენი',
      sourceLocale: 'ka',
      variety: null,
      packaging: null,
      destinationCountry: null,
      message: null,
      translations: [
        { locale: 'ru', status: 'completed', title: 'виноград' },
        { locale: 'en', status: 'completed', title: 'grapes' },
        { locale: 'de', status: 'completed', title: 'Trauben' },
        { locale: 'fr', status: 'completed', title: 'raisin' },
      ],
    };
    for (const query of ['виноград', 'grapes', 'Trauben', 'raisin', 'ყურძენი']) {
      expect(
        catalogTextMatches(query, [
          request.title,
          request.variety,
          request.packaging,
          request.destinationCountry,
          request.message,
          ...completedTranslationSearchParts(request.translations),
        ]),
      ).toBe(true);
    }
    expect(presentPurchaseRequestText(request, 'ru').display.title).toBe('виноград');
    expect(presentPurchaseRequestText(request, 'ru').source.title).toBe('ყურძენი');
    expect(presentPurchaseRequestText(request, 'es').display.title).toBe('ყურძენი');
  });

  it('shows a completed farm description in the requested locale and keeps the source', () => {
    const farm = {
      name: 'Kakheti Rosé House',
      sourceLocale: 'ka',
      description: 'საოჯახო მეურნეობა',
      history: null,
      ownershipType: null,
      exportMarkets: ['ევროპა'],
      translations: [
        {
          locale: 'ru',
          status: 'completed',
          description: 'Семейное хозяйство',
          history: null,
          ownershipType: null,
          exportMarkets: ['Европа'],
        },
      ],
    };
    const presented = presentFarmText(farm, 'ru');
    expect(presented.display.description).toBe('Семейное хозяйство');
    expect(presented.display.exportMarkets).toEqual(['Европа']);
    expect(presented.source.description).toBe('საოჯახო მეურნეობა');
    expect(presented.source).not.toHaveProperty('name');
    expect(farm.description).toBe('საოჯახო მეურნეობა');
  });

  it('falls back to the original farm text when translation failed', () => {
    const farm = {
      sourceLocale: 'en',
      description: 'Family farm in Kakheti',
      history: null,
      ownershipType: null,
      exportMarkets: [],
      translations: [{ locale: 'ru', status: 'failed', description: null, exportMarkets: [] }],
    };
    const presented = presentFarmText(farm, 'ru');
    expect(presented.display.description).toBe('Family farm in Kakheti');
    expect(presented.display.translationStatus).toBe('failed');
    expect(presented.source.description).toBe('Family farm in Kakheti');
  });

  it('hides a translation toggle when the viewer locale is the source locale', () => {
    const presented = presentFarmText(
      {
        sourceLocale: 'ru',
        description: 'Семейное хозяйство',
        history: null,
        ownershipType: null,
        exportMarkets: [],
      },
      'ru',
    );
    expect(presented.display.translationStatus).toBe('source');
    expect(presented.display.description).toBe(presented.source.description);
  });

  it('requires a photo only for a new publication', () => {
    expect(
      publicationBlockedForMissingPhoto({ nextPublished: false, photoCount: 0 }),
    ).toBe(false);
    expect(
      publicationBlockedForMissingPhoto({
        nextPublished: true,
        previousPublished: false,
        photoCount: 0,
      }),
    ).toBe(true);
    expect(
      publicationBlockedForMissingPhoto({
        nextPublished: true,
        previousPublished: true,
        photoCount: 0,
      }),
    ).toBe(false);
    expect(
      publicationBlockedForMissingPhoto({
        nextPublished: true,
        previousPublished: false,
        photoCount: 1,
      }),
    ).toBe(false);
  });

  it('does not search pending translation text', () => {
    expect(
      catalogTextMatches('виноград', [
        'ყურძენი',
        ...completedTranslationSearchParts([
          { locale: 'ru', status: 'pending', title: 'виноград' },
        ]),
      ]),
    ).toBe(false);
    expect(catalogTextMatches('ყურძენი', ['ყურძენი'])).toBe(true);
  });
});
