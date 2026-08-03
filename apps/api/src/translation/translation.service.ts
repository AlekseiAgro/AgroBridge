import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Locale } from '@agrobridge/shared';
import { LocaleCode, MessageTranslationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MockTranslationProvider } from './mock-translation.provider';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import type { TranslationProvider } from './translation.types';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly provider: TranslationProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    mockProvider: MockTranslationProvider,
    openAiProvider: OpenAiTranslationProvider,
  ) {
    const selected = (this.config.get<string>('TRANSLATION_PROVIDER') ?? 'mock').toLowerCase();
    this.provider =
      selected === 'openai' && this.config.get<string>('OPENAI_API_KEY')
        ? openAiProvider
        : mockProvider;

    this.logger.log(`Using translation provider: ${this.provider.name}`);
  }

  async translateMessage(params: {
    messageId: string;
    sourceText: string;
    sourceLocale: Locale;
    targetLocale: Locale;
  }) {
    if (params.sourceLocale === params.targetLocale) {
      return this.prisma.messageTranslation.upsert({
        where: {
          messageId_targetLocale: {
            messageId: params.messageId,
            targetLocale: params.targetLocale as LocaleCode,
          },
        },
        create: {
          messageId: params.messageId,
          targetLocale: params.targetLocale as LocaleCode,
          translatedText: params.sourceText,
          status: MessageTranslationStatus.completed,
          provider: this.provider.name,
        },
        update: {
          translatedText: params.sourceText,
          status: MessageTranslationStatus.completed,
          provider: this.provider.name,
          error: null,
        },
      });
    }

    await this.prisma.messageTranslation.upsert({
      where: {
        messageId_targetLocale: {
          messageId: params.messageId,
          targetLocale: params.targetLocale as LocaleCode,
        },
      },
      create: {
        messageId: params.messageId,
        targetLocale: params.targetLocale as LocaleCode,
        status: MessageTranslationStatus.pending,
        provider: this.provider.name,
      },
      update: {
        status: MessageTranslationStatus.pending,
        error: null,
        provider: this.provider.name,
      },
    });

    try {
      const result = await this.provider.translate({
        text: params.sourceText,
        sourceLocale: params.sourceLocale,
        targetLocale: params.targetLocale,
      });

      return this.prisma.messageTranslation.update({
        where: {
          messageId_targetLocale: {
            messageId: params.messageId,
            targetLocale: params.targetLocale as LocaleCode,
          },
        },
        data: {
          translatedText: result.translatedText,
          status: MessageTranslationStatus.completed,
          provider: result.provider,
          error: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Translation failed';
      this.logger.warn(`Translation failed for message ${params.messageId}: ${message}`);

      return this.prisma.messageTranslation.update({
        where: {
          messageId_targetLocale: {
            messageId: params.messageId,
            targetLocale: params.targetLocale as LocaleCode,
          },
        },
        data: {
          status: MessageTranslationStatus.failed,
          error: message,
        },
      });
    }
  }
}
