import { productsPath } from './query';
import {
  activeFilterCount,
  catalogFiltersFromRoute,
  catalogProductsInput,
  clearRegions,
  emptyCatalogFilters,
  filterSummaryLabel,
  regionFilterSummary,
  setCatalogFlag,
  toggleRegion,
  toggleSingleFilter,
} from './filters';

const summary = (regions: string[]) =>
  regionFilterSummary(regions, {
    any: 'Any',
    single: (region) => region,
    many: (count) => `${count} selected`,
  });

describe('catalog filters', () => {
  it('counts active filters and formats the compact summary', () => {
    const filters = setCatalogFlag(
      setCatalogFlag(
        {
          ...emptyCatalogFilters(),
          categoryId: 'fruits',
          regions: ['kakheti', 'imereti', 'kvemoKartli'],
          harvestStatus: 'available',
        },
        'preorder',
        true,
      ),
      'inSeason',
      true,
    );
    expect(activeFilterCount(filters)).toBe(5);
    expect(filterSummaryLabel('Filters', 5)).toBe('Filters · 5');
    expect(filterSummaryLabel('Filters', 0)).toBe('Filters');
  });

  it('resets every filter, including regions, to the unrestricted default', () => {
    const cleared = emptyCatalogFilters();
    expect(cleared.regions).toEqual([]);
    expect(activeFilterCount(cleared)).toBe(0);
    expect(summary(cleared.regions)).toBe('Any');
    expect(productsPath(catalogProductsInput(cleared))).toBe('/products');
  });

  it('keeps one category because the API accepts a single category', () => {
    const fruits = toggleSingleFilter(emptyCatalogFilters(), 'categoryId', 'fruits');
    const berries = toggleSingleFilter(fruits, 'categoryId', 'berries');
    expect(berries.categoryId).toBe('berries');
    expect(productsPath({ categoryId: berries.categoryId })).toBe('/products?category=berries');
  });

  it('selects one region and keeps it selected', () => {
    const kakheti = toggleRegion(emptyCatalogFilters(), 'kakheti');
    expect(kakheti.regions).toEqual(['kakheti']);
    expect(summary(kakheti.regions)).toBe('kakheti');
    expect(productsPath(catalogProductsInput(kakheti))).toBe('/products?region=kakheti');
    const reopened = catalogFiltersFromRoute({ regions: kakheti.regions });
    expect(reopened.regions).toEqual(['kakheti']);
  });

  it('selects Kakheti, Imereti, and Kvemo Kartli together', () => {
    const selected = ['kakheti', 'imereti', 'kvemoKartli'].reduce(
      (filters, region) => toggleRegion(filters, region),
      emptyCatalogFilters(),
    );
    expect(selected.regions).toEqual(['kakheti', 'imereti', 'kvemoKartli']);
    expect(summary(selected.regions)).toBe('3 selected');
    expect(summary(['kakheti', 'imereti'])).toBe('2 selected');
    expect(productsPath(catalogProductsInput(selected))).toBe(
      '/products?region=kakheti&region=imereti&region=kvemoKartli',
    );
    expect(catalogFiltersFromRoute({ regions: selected.regions }).regions).toEqual(selected.regions);
  });

  it('clears every region when Any is chosen and returns to Any when the last region is removed', () => {
    const selected = toggleRegion(toggleRegion(emptyCatalogFilters(), 'kakheti'), 'imereti');
    expect(clearRegions(selected).regions).toEqual([]);
    expect(summary(clearRegions(selected).regions)).toBe('Any');
    const withoutImereti = toggleRegion(selected, 'imereti');
    const withoutKakheti = toggleRegion(withoutImereti, 'kakheti');
    expect(withoutKakheti.regions).toEqual([]);
    expect(summary(withoutKakheti.regions)).toBe('Any');
    expect(productsPath(catalogProductsInput(withoutKakheti))).toBe('/products');
  });

  it('keeps one harvest status because the API accepts a single status', () => {
    const available = toggleSingleFilter(emptyCatalogFilters(), 'harvestStatus', 'available');
    const limited = toggleSingleFilter(available, 'harvestStatus', 'limited');
    expect(limited.harvestStatus).toBe('limited');
    expect(productsPath({ harvestStatus: limited.harvestStatus })).toBe('/products?harvestStatus=limited');
  });

  it('builds one query from search text, category, regions, and the other filters', () => {
    const filters = setCatalogFlag(
      {
        ...emptyCatalogFilters(),
        categoryId: 'fruits',
        regions: ['kakheti', 'imereti', 'kvemoKartli'],
        harvestStatus: 'available',
      },
      'preorder',
      true,
    );
    expect(productsPath(catalogProductsInput(filters, { query: 'grape', locale: 'en' }))).toBe(
      '/products?category=fruits&q=grape&locale=en&region=kakheti&region=imereti&region=kvemoKartli&harvestStatus=available&preorder=true',
    );
  });

  it('opens the catalog from Home with the selected category and no region restriction', () => {
    const filters = catalogFiltersFromRoute({ categoryId: 'fruits' });
    expect(filters.categoryId).toBe('fruits');
    expect(filters.regions).toEqual([]);
    expect(activeFilterCount(filters)).toBe(1);
    expect(productsPath(catalogProductsInput(filters))).toBe('/products?category=fruits');
  });
});