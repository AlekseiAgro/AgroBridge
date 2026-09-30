import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PRODUCER_TYPES, producerTypeFromLegacyOwnership } from '@agrobridge/shared';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

const LOCALES = ['ka', 'en', 'ru', 'de', 'fr', 'it', 'es'] as const;

describe('producer type', () => {
  it('maps only unambiguous legacy ownership text', () => {
    expect(producerTypeFromLegacyOwnership('family')).toBe('family');
    expect(producerTypeFromLegacyOwnership('Family')).toBe('family');
    expect(producerTypeFromLegacyOwnership('cooperative')).toBe('cooperative');
    expect(producerTypeFromLegacyOwnership('Cooperative')).toBe('cooperative');
    expect(producerTypeFromLegacyOwnership('Private farm')).toBe('individual');
    expect(producerTypeFromLegacyOwnership('Частное хозяйство')).toBe('individual');
    expect(producerTypeFromLegacyOwnership('llc')).toBeNull();
    expect(producerTypeFromLegacyOwnership('LLC')).toBeNull();
    expect(producerTypeFromLegacyOwnership('something else')).toBeNull();
    expect(producerTypeFromLegacyOwnership(null)).toBeNull();
  });

  it.each([CreateFarmDto, UpdateFarmDto])('accepts producer type keys and rejects arbitrary text', async (Dto) => {
    const valid = plainToInstance(Dto, { name: 'Farm', producerType: 'family' });
    expect(await validate(valid)).toEqual([]);

    const invalid = plainToInstance(Dto, { name: 'Farm', producerType: 'Private farm' });
    const errors = await validate(invalid);
    expect(errors.some((error) => error.property === 'producerType')).toBe(true);
  });

  it('keeps localized producer labels for every catalog locale', () => {
    for (const locale of LOCALES) {
      const messages = JSON.parse(
        readFileSync(join(__dirname, '../../../web/messages', `${locale}.json`), 'utf8'),
      ) as { farm: { producerType: string; producerTypes: Record<string, string> } };
      expect(messages.farm.producerType.trim().length).toBeGreaterThan(0);
      for (const key of PRODUCER_TYPES) {
        expect(messages.farm.producerTypes[key]?.trim().length).toBeGreaterThan(0);
      }
      if (locale !== 'en') {
        expect(messages.farm.producerTypes.family).not.toBe('Family farm');
      }
    }
  });

  it('clears translated variety values without rewriting the original columns', () => {
    const sql = readFileSync(
      join(__dirname, '../../prisma/migrations/20260930180000_producer_type_and_variety_cleanup/migration.sql'),
      'utf8',
    );
    expect(sql).toContain('UPDATE "product_translations"');
    expect(sql).toContain('SET "variety" = NULL');
    expect(sql).toContain('UPDATE "purchase_request_translations"');
    expect(sql).not.toMatch(/UPDATE "Product"/);
    expect(sql).not.toMatch(/UPDATE "PurchaseRequest"/);
    expect(sql).not.toMatch(/llc/i);
    expect(sql).not.toContain("THEN 'company'");
  });
});