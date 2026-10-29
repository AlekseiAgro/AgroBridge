import {
  PRODUCT_PHONE_CHECK_FIELDS,
  PURCHASE_REQUEST_PHONE_CHECK_FIELDS,
  productPhoneLikeFields,
  purchaseRequestPhoneLikeFields,
} from '@agrobridge/shared';
import { readFileSync } from 'fs';
import { join } from 'path';

const WEB = join(__dirname, '../../../web/src');
const WEB_MESSAGES = join(__dirname, '../../../web/messages');
const LOCALES = ['ka', 'en', 'ru', 'de', 'fr', 'it', 'es'] as const;

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

function messages(locale: string) {
  return JSON.parse(readFileSync(join(WEB_MESSAGES, `${locale}.json`), 'utf8')) as {
    admin: {
      requests: Record<string, unknown>;
      phoneFlag: { badge: string; fields: string; fieldNames: Record<string, string> };
    };
  };
}

describe('admin phone-like content flag', () => {
  const queue = readWeb('app/[locale]/dashboard/admin/page.tsx');
  const preview = readWeb('app/[locale]/dashboard/admin/products/[id]/page.tsx');
  const flag = readWeb('components/AdminPhoneFlag.tsx');

  it('names the flagged fields for products and purchase requests', () => {
    expect(
      productPhoneLikeFields({
        title: 'Apples',
        description: 'Call +995 591 71 23 16',
        variety: 'Golden',
        originPlace: null,
        customDelivery: 'Viber 599123456',
      }),
    ).toEqual(['description', 'customDelivery']);
    expect(
      purchaseRequestPhoneLikeFields({
        title: 'Hazelnuts 20 t',
        message: 'Price 2.50 GEL/kg, HS code 0802.21',
        variety: null,
        packaging: 'WhatsApp: 591712316',
      }),
    ).toEqual(['packaging']);
  });

  it('shows the flag on the product queue, the request queue and the product preview', () => {
    expect(queue).toContain('<AdminPhoneFlag fields={product.phoneLikeFields ?? []} />');
    expect(queue).toContain('<AdminPhoneFlag fields={request.phoneLikeFields ?? []} />');
    expect(queue).toContain("t('requests.openRequest')");
    expect(preview).toContain('<AdminPhoneFlag fields={productPhoneLikeFields(product)} />');
    expect(flag).toContain("useTranslations('admin.phoneFlag')");
    expect(flag).toContain('t(`fieldNames.${field}`)');
  });

  it('keeps the flag advisory: it adds no automatic moderation action', () => {
    expect(flag).not.toMatch(/fetch\(|onClick|useRouter|'use client'/);
    expect(preview).toContain(
      '<ModerationActions productId={product.id} returnHref={queueHref} />',
    );
  });

  it.each(LOCALES)('has the flag strings in %s', (locale) => {
    const admin = messages(locale).admin;
    expect(admin.phoneFlag.badge.trim()).not.toBe('');
    expect(admin.phoneFlag.fields).toContain('{fields}');
    expect(typeof admin.requests.openRequest).toBe('string');
    for (const field of new Set([
      ...PRODUCT_PHONE_CHECK_FIELDS,
      ...PURCHASE_REQUEST_PHONE_CHECK_FIELDS,
    ])) {
      expect(admin.phoneFlag.fieldNames[field]?.trim()).toBeTruthy();
    }
  });
});
