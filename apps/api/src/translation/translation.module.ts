import { Module } from '@nestjs/common';
import { MockTranslationProvider } from './mock-translation.provider';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import { TranslationService } from './translation.service';

@Module({
  providers: [MockTranslationProvider, OpenAiTranslationProvider, TranslationService],
  exports: [TranslationService],
})
export class TranslationModule {}
