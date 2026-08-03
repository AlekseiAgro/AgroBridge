import { Module } from '@nestjs/common';
import { RatingsModule } from '../ratings/ratings.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [RatingsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
