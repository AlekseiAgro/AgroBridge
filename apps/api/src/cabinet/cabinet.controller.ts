import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CabinetService } from './cabinet.service';

@Controller('cabinet')
@UseGuards(JwtAuthGuard)
export class CabinetController {
  constructor(private readonly cabinetService: CabinetService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.cabinetService.overview(user);
  }
}
