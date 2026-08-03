import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CabinetService } from './cabinet.service';
import {
  ConfirmAccountDeletionDto,
  RequestAccountDeletionDto,
} from './dto/delete-account.dto';

@Controller('cabinet')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class CabinetController {
  constructor(private readonly cabinetService: CabinetService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.cabinetService.overview(user);
  }

  @Post('me/delete/request')
  requestDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestAccountDeletionDto,
  ) {
    return this.cabinetService.requestAccountDeletion(user, dto.password);
  }

  @Post('me/delete/confirm')
  confirmDeletion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmAccountDeletionDto,
  ) {
    return this.cabinetService.confirmAccountDeletion(user, dto.password, dto.code);
  }
}
