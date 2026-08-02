import { TranslationService } from './translation.service';
import { MockTranslationProvider } from './mock-translation.provider';

describe('MockTranslationProvider', () => {
  it('marks language pair for different locales', async () => {
    const provider = new MockTranslationProvider();
    const result = await provider.translate({
      text: 'გამარჯობა',
      sourceLocale: 'ka',
      targetLocale: 'en',
    });

    expect(result.provider).toBe('mock');
    expect(result.translatedText).toContain('[ka→en]');
    expect(result.translatedText).toContain('გამარჯობა');
  });
});

describe('TranslationService provider selection', () => {
  it('falls back to mock when openai is selected without key', () => {
    const prisma = {} as never;
    const config = {
      get: (key: string) => {
        if (key === 'TRANSLATION_PROVIDER') return 'openai';
        return undefined;
      },
    };
    const mock = new MockTranslationProvider();
    const openAi = { name: 'openai', translate: jest.fn() };

    const service = new TranslationService(
      prisma,
      config as never,
      mock,
      openAi as never,
    );

    expect((service as unknown as { provider: { name: string } }).provider.name).toBe('mock');
  });
});
