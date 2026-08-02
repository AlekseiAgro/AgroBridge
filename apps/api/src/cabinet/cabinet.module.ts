import { Module } from '@nestjs/common';
import { RatingsModule } from '../ratings/ratings.module';
import { CabinetController } from './cabinet.controller';
import { CabinetService } from './cabinet.service';

@Module({
  imports: [RatingsModule],
  controllers: [CabinetController],
  providers: [CabinetService],
})
export class CabinetModule {}
