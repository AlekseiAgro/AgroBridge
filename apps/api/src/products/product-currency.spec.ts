import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CURRENCIES,
  DEFAULT_PRODUCT_CURRENCY,
  PRICE_CURRENCIES,
  formatListedPrice,
  isCurrencyCode,
  isPriceCurrency,
} from '@agrobridge/shared';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const ROOT = join(__dirname, '../../..');
const WEB = join(__dirname, '../../../web');

function source(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function webSource(rel: string): string {
  return readFileSync(join(WEB, 'src', rel), 'utf8');
}

function formCurrency(initial?: { priceCurrency?: string | null }): string {
  return initial?.priceCurrency ?? DEFAULT_PRODUCT_CURRENCY;
}

async function errorsOf(dto: object): Promise<string[]> {
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('product currency consistency', () => {
  it('uses one canonical GEL / EUR / USD set', () => {
    expect(CURRENCIES).toEqual(['GEL', 'EUR', 'USD']);
    expect(PRICE_CURRENCIES).toEqual(['GEL', 'EUR', 'USD']);
    expect(DEFAULT_PRODUCT_CURRENCY).toBe('GEL');
    expect(isCurrencyCode('GEL')).toBe(true);
    expect(isCurrencyCode('EUR')).toBe(true);
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isPriceCurrency('GBP')).toBe(false);
    expect(isCurrencyCode('eur')).toBe(false);
  });

  it('defaults a new product form to GEL and keeps saved EUR / USD when editing', () => {
    expect(formCurrency()).toBe('GEL');
    expect(formCurrency({ priceCurrency: null })).toBe('GEL');
    expect(formCurrency({ priceCurrency: 'EUR' })).toBe('EUR');
    expect(formCurrency({ priceCurrency: 'USD' })).toBe('USD');
    expect(formCurrency({ priceCurrency: 'GEL' })).toBe('GEL');

    const form = webSource('components/ProductForm.tsx');
    expect(form).toContain('initial?.priceCurrency ?? DEFAULT_PRODUCT_CURRENCY');
    expect(form).not.toContain("?? 'EUR'");
    expect(form).toContain('PRICE_CURRENCIES.map');
  });

  it('accepts GEL / EUR / USD on create and update and rejects invalid codes', async () => {
    for (const currency of ['GEL', 'EUR', 'USD'] as const) {
      expect(
        await errorsOf(plainToInstance(CreateProductDto, { title: 'Hazelnuts', priceCurrency: currency })),
      ).toEqual([]);
      expect(
        await errorsOf(plainToInstance(UpdateProductDto, { priceCurrency: currency })),
      ).toEqual([]);
    }

    expect(await errorsOf(plainToInstance(CreateProductDto, { title: 'Hazelnuts' }))).toEqual([]);
    expect(
      await errorsOf(plainToInstance(CreateProductDto, { title: 'Hazelnuts', priceCurrency: null })),
    ).toEqual([]);
    expect(await errorsOf(plainToInstance(UpdateProductDto, { priceCurrency: null }))).toEqual([]);

    const invalidCreate = await errorsOf(
      plainToInstance(CreateProductDto, { title: 'Hazelnuts', priceCurrency: 'GBP' }),
    );
    const invalidUpdate = await errorsOf(
      plainToInstance(UpdateProductDto, { priceCurrency: 'btc' }),
    );
    expect(invalidCreate.some((message) => message.includes('GEL, EUR, or USD'))).toBe(true);
    expect(invalidUpdate.some((message) => message.includes('GEL, EUR, or USD'))).toBe(true);
  });

  it('formats the stored product currency without FX conversion', () => {
    expect(formatListedPrice({ priceFrom: 10, priceCurrency: 'GEL' })).toBe('₾ 10.00');
    expect(formatListedPrice({ priceFrom: 10, priceCurrency: 'EUR' })).toBe('€ 10.00');
    expect(formatListedPrice({ priceFrom: 10, priceCurrency: 'USD' })).toBe('$ 10.00');
    expect(formatListedPrice({ priceFrom: 2.62, priceCurrency: 'EUR' })).toBe('€ 2.62');

    const helper = source('packages/shared/src/product-price.ts');
    expect(helper).not.toMatch(/exchange|fx|convert|rate/i);
    expect(helper).not.toContain("?? 'EUR'");
    expect(helper).not.toContain("?? 'GEL'");
  });

  it('does not rewrite existing EUR / USD rows or prices in the Prisma migration', () => {
    const migration = source(
      'apps/api/prisma/migrations/20260922120000_product_price_currency_enum/migration.sql',
    );
    expect(migration).toContain('TYPE "CurrencyCode"');
    expect(migration).toContain(`WHEN "priceCurrency" IN ('GEL', 'EUR', 'USD')`);
    expect(migration).not.toMatch(/priceFrom/);
    expect(migration).not.toMatch(/SET\s+"priceCurrency"\s*=\s*'GEL'/);
    expect(migration).not.toMatch(/UPDATE\s+"Product"/i);
    expect(migration).not.toMatch(/exchange|convert|fx/i);
  });

  it('keeps quote amount and currency unchanged on accept', () => {
    const quotes = source('apps/api/src/purchase-requests/purchase-requests.service.ts');
    const acceptStart = quotes.indexOf('async acceptQuote(');
    const acceptBody = quotes.slice(acceptStart, quotes.indexOf('async declineQuote', acceptStart));
    expect(acceptBody).toContain('data: { status: PurchaseQuoteStatus.accepted }');
    expect(acceptBody).not.toMatch(/priceAmount/);
    expect(acceptBody).not.toMatch(/currency:/);
    expect(acceptBody).not.toMatch(/exchange|convert|fx/i);

    const presentation = webSource('lib/quote-card-presentation.ts');
    expect(presentation).toContain('`${priceAmount} ${currency}`');
    expect(presentation).toContain('No FX or rounding');
  });
});
