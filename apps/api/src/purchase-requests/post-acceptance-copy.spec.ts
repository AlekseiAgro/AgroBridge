import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const MESSAGES_DIR = join(__dirname, '../../../web/messages');

const DELIVERY_WORDS = [
  'fulfilled',
  'исполнен',
  'исполненные',
  'შესრულებული',
  'erfüllt',
  'satisfait',
  'satisfaite',
  'satisfaites',
  'evasa',
  'evaso',
  'cumplida',
  'cumplidas',
];

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    purchaseRequests: {
      agreementTitle: string;
      agreementBody: string;
      statuses: { fulfilled: string };
    };
  };
}

describe('post-acceptance user-facing copy', () => {
  it('localizes the agreement copy in every supported locale', () => {
    for (const locale of LOCALES) {
      const copy = loadMessages(locale).purchaseRequests;
      expect(copy.agreementTitle.trim().length).toBeGreaterThan(0);
      expect(copy.agreementBody.trim().length).toBeGreaterThan(0);
      expect(copy.statuses.fulfilled.trim().length).toBeGreaterThan(0);
    }
  });

  it('does not present the technical fulfilled state as physical delivery', () => {
    for (const locale of LOCALES) {
      const copy = loadMessages(locale).purchaseRequests;
      const haystack =
        `${copy.agreementTitle} ${copy.agreementBody} ${copy.statuses.fulfilled}`.toLowerCase();
      for (const word of DELIVERY_WORDS) {
        expect(haystack).not.toContain(word);
      }
    }
  });
});
