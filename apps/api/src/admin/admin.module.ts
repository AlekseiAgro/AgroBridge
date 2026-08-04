import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsModule } from '../products/products.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { VerificationModule } from '../verification/verification.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [CategoriesModule, ProductsModule, SubscriptionsModule, VerificationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
