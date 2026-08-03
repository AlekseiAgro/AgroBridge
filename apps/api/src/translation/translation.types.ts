import type { Locale } from '@agrobridge/shared';

export type TranslateInput = {
  text: string;
  sourceLocale: Locale;
  targetLocale: Locale;
};

export type TranslateResult = {
  translatedText: string;
  provider: string;
};

export interface TranslationProvider {
  readonly name: string;
  translate(input: TranslateInput): Promise<TranslateResult>;
}
