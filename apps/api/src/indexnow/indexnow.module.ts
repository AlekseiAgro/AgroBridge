import { Global, Module } from '@nestjs/common';
import { IndexNowService } from './indexnow.service';

@Global()
@Module({
  providers: [IndexNowService],
  exports: [IndexNowService],
})
export class IndexNowModule {}
