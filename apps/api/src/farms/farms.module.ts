import { Module } from '@nestjs/common';
import { RatingsModule } from '../ratings/ratings.module';
import { StorageModule } from '../storage/storage.module';
import { VerificationModule } from '../verification/verification.module';
import { FarmDocumentsController } from './farm-documents.controller';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';

@Module({
  imports: [RatingsModule, StorageModule, VerificationModule],
  controllers: [FarmDocumentsController, FarmsController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
