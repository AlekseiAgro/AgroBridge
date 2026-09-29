import { Module } from '@nestjs/common';
import { CatalogTranslationModule } from '../catalog/catalog-translation.module';
import { CategoriesModule } from '../categories/categories.module';
import { RatingsModule } from '../ratings/ratings.module';
import { StorageModule } from '../storage/storage.module';
import { MarketInsightService } from './market-insight.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [StorageModule, RatingsModule, CategoriesModule, CatalogTranslationModule],
  controllers: [ProductsController],
  providers: [ProductsService, MarketInsightService],
  exports: [ProductsService],
})
export class ProductsModule {}
