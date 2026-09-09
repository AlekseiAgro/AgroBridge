import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { RatingsModule } from '../ratings/ratings.module';
import { VerificationModule } from '../verification/verification.module';
import { CabinetController } from './cabinet.controller';
import { CabinetService } from './cabinet.service';

@Module({
  imports: [RatingsModule, ChatModule, VerificationModule],
  controllers: [CabinetController],
  providers: [CabinetService],
})
export class CabinetModule {}
