import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TranslateInput, TranslateResult, TranslationProvider } from './translation.types';

@Injectable()
export class OpenAiTranslationProvider implements TranslationProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiTranslationProvider.name);

  constructor(private readonly config: ConfigService) {}

  async translate(input: TranslateInput): Promise<TranslateResult> {
    if (input.sourceLocale === input.targetLocale) {
      return { translatedText: input.text, provider: this.name };
    }

    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const model = this.config.get<string>('OPENAI_TRANSLATION_MODEL') ?? 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a translation engine for an agricultural B2B marketplace. ' +
              'Translate the user message accurately. Preserve numbers, units, cultivar names, and Incoterms. ' +
              'Return only the translated text with no quotes or commentary.',
          },
          {
            role: 'user',
            content: `Source language: ${input.sourceLocale}\nTarget language: ${input.targetLocale}\n\n${input.text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`OpenAI translation failed: ${response.status} ${body}`);
      throw new Error(`OpenAI translation failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translatedText = data.choices?.[0]?.message?.content?.trim();
    if (!translatedText) {
      throw new Error('OpenAI returned an empty translation');
    }

    return { translatedText, provider: this.name };
  }
}
