import { Module } from '@nestjs/common';
import { CatalogTranslationModule } from '../catalog/catalog-translation.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PurchaseRequestsController } from './purchase-requests.controller';
import { PurchaseRequestsService } from './purchase-requests.service';

@Module({
  imports: [SubscriptionsModule, CatalogTranslationModule],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService],
  exports: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
