import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingsService } from './ratings.service';

@Controller()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post('ratings')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRatingDto) {
    return this.ratingsService.create(user, dto);
  }

  @Get('users/:id/rating')
  summary(@Param('id') id: string) {
    return this.ratingsService.summaryForUser(id);
  }
}
