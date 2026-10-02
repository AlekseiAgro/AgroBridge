import 'reflect-metadata';
import { GEORGIA_REGIONS } from '@agrobridge/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogQueryDto, CATALOG_REGION_LIMIT, normalizeCatalogRegions } from './catalog-query.dto';

async function parsed(plain: Record<string, unknown>) {
  const dto = plainToInstance(CatalogQueryDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CatalogQueryDto region', () => {
  it('leaves the catalog unrestricted when region is omitted or blank', async () => {
    const omitted = await parsed({});
    const blank = await parsed({ region: '   ' });
    expect(omitted.errors).toEqual([]);
    expect(omitted.dto.region).toBeUndefined();
    expect(blank.errors).toEqual([]);
    expect(blank.dto.region).toBeUndefined();
    expect(normalizeCatalogRegions(undefined)).toEqual([]);
  });

  it('keeps a single region string compatible with the previous query', async () => {
    const { dto, errors } = await parsed({ region: 'imereti' });
    expect(errors).toEqual([]);
    expect(dto.region).toEqual(['imereti']);
    expect(normalizeCatalogRegions('imereti')).toEqual(['imereti']);
  });

  it('accepts repeated region parameters as an OR list', async () => {
    const two = await parsed({ region: ['kakheti', 'imereti'] });
    const three = await parsed({ region: ['kakheti', 'imereti', 'kvemoKartli'] });
    expect(two.errors).toEqual([]);
    expect(two.dto.region).toEqual(['kakheti', 'imereti']);
    expect(three.errors).toEqual([]);
    expect(three.dto.region).toEqual(['kakheti', 'imereti', 'kvemoKartli']);
  });

  it('collapses duplicate region values before they reach the database filter', async () => {
    const { dto, errors } = await parsed({ region: ['kakheti', 'Kakheti', 'kakheti'] });
    expect(errors).toEqual([]);
    expect(dto.region).toEqual(['kakheti']);
  });

  it('accepts every official region in one request', async () => {
    const { dto, errors } = await parsed({ region: [...GEORGIA_REGIONS] });
    expect(errors).toEqual([]);
    expect(dto.region).toHaveLength(CATALOG_REGION_LIMIT);
  });

  it('rejects a region longer than 120 characters', async () => {
    const { errors } = await parsed({ region: 'k'.repeat(121) });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects more distinct regions than the official list', async () => {
    const tooMany = Array.from({ length: CATALOG_REGION_LIMIT + 1 }, (_, index) => `region${index}`);
    const { errors } = await parsed({ region: tooMany });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string region value', async () => {
    const { errors } = await parsed({ region: [1] });
    expect(errors.length).toBeGreaterThan(0);
  });
});
