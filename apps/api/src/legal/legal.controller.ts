import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { isLegalLocale, type LegalLocale } from '@agrobridge/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LegalService } from './legal.service';

@Controller('legal')
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Get('documents/current')
  currentDocuments(@Query('locale') locale?: string) {
    const legalLocale = locale && isLegalLocale(locale) ? (locale as LegalLocale) : undefined;
    return this.legal.currentDocuments(legalLocale);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  myAcceptance(@CurrentUser() user: AuthenticatedUser) {
    return this.legal.acceptanceSnapshot(user.id, user.locale);
  }
}
