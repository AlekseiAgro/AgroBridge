import { Injectable } from '@nestjs/common';
import type { TranslateInput, TranslateResult, TranslationProvider } from './translation.types';

/**
 * Deterministic offline translator for local/dev.
 * Keeps the original text and marks the language pair so the UI flow can be tested
 * without an external LLM key.
 */
@Injectable()
export class MockTranslationProvider implements TranslationProvider {
  readonly name = 'mock';

  async translate(input: TranslateInput): Promise<TranslateResult> {
    if (input.sourceLocale === input.targetLocale) {
      return { translatedText: input.text, provider: this.name };
    }

    return {
      translatedText: `[${input.sourceLocale}→${input.targetLocale}] ${input.text}`,
      provider: this.name,
    };
  }
}
