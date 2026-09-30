import { en, type MessageKey } from './en';
import { ru } from './ru';
import { APP_LOCALES, localeFromLanguageCode } from './locales';
import { translate } from './translate';

describe('translate', () => {
  it('returns the English baseline', () => {
    expect(translate('en', 'home.searchPlaceholder')).toBe('Search products, farms...');
  });

  it('uses Russian trade terminology', () => {
    expect(translate('ru', 'home.opportunities')).toBe('Запросы на покупку');
    expect(translate('ru', 'messages.emptyBody')).toContain('предложениям');
    expect(translate('ru', 'home.platform')).toContain('платформа');
  });

  it('falls back to English for locales without a dictionary', () => {
    expect(translate('de', 'tabs.home')).toBe(en['tabs.home']);
    expect(translate('ka', 'tabs.requests')).toBe('Requests');
    expect(translate('fr', 'home.searchPlaceholder')).toBe(en['home.searchPlaceholder']);
    expect(translate('it', 'tabs.account')).toBe(en['tabs.account']);
    expect(translate('es', 'tabs.messages')).toBe(en['tabs.messages']);
  });

  it('translates every new farm-screen string in all seven locales', () => {
    const farmKeys = (Object.keys(en) as MessageKey[]).filter((key) => key.startsWith('farm.'));
    expect(farmKeys.length).toBeGreaterThan(0);
    for (const locale of APP_LOCALES) {
      if (locale === 'en') {
        continue;
      }
      for (const key of farmKeys) {
        const value = translate(locale, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(en[key]);
      }
    }
    expect(translate('ru', 'farm.about')).toBe(ru['farm.about']);
  });

  it('interpolates parameters', () => {
    expect(translate('en', 'a11y.selectCategory', { category: 'Wine' })).toBe('Show Wine');
  });

  it('keeps Russian copy free of quotation and RFQ wording', () => {
    const text = Object.values(ru).join('\n');
    expect(text.toLowerCase()).not.toContain('котиров');
    expect(text).not.toMatch(/\bRFQ\b/);
  });
});

describe('localeFromLanguageCode', () => {
  it('accepts every AgroBridge locale and falls back otherwise', () => {
    expect(localeFromLanguageCode('ka')).toBe('ka');
    expect(localeFromLanguageCode('ru-RU')).toBe('ru');
    expect(localeFromLanguageCode('de')).toBe('de');
    expect(localeFromLanguageCode('pt')).toBe('en');
    expect(localeFromLanguageCode(null)).toBe('en');
  });
});
