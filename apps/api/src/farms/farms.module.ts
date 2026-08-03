import { Module } from '@nestjs/common';
import { RatingsModule } from '../ratings/ratings.module';
import { StorageModule } from '../storage/storage.module';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';

@Module({
  imports: [RatingsModule, StorageModule],
  controllers: [FarmsController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
