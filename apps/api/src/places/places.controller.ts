import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('autocomplete')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard, RateLimitGuard)
  @RateLimit('placesAutocompletePerAccount')
  @Roles('farmer', 'buyer', 'admin')
  autocomplete(
    @Query('q') q?: string,
    @Query('language') language?: string,
    @Query('country') country?: string,
  ) {
    return this.placesService.autocomplete(q ?? '', { language, country });
  }
}
