import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { RatingsModule } from '../ratings/ratings.module';
import { StorageModule } from '../storage/storage.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [StorageModule, RatingsModule, CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
