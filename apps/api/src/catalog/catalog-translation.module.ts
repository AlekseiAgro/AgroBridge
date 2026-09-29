import { Module } from '@nestjs/common';
import { TranslationModule } from '../translation/translation.module';
import { CatalogTranslationService } from './catalog-translation.service';

@Module({
  imports: [TranslationModule],
  providers: [CatalogTranslationService],
  exports: [CatalogTranslationService],
})
export class CatalogTranslationModule {}
