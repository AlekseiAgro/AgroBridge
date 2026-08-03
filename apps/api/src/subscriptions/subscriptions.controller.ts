import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpsertAlertSubscriptionDto } from './dto/upsert-alert-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('alerts')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getMine(user);
  }

  @Put('alerts')
  upsertMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertAlertSubscriptionDto,
  ) {
    return this.subscriptionsService.upsertMine(user, dto);
  }
}
