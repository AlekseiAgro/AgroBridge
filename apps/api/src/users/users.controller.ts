import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getPublicProfile(
    @Param('id') id: string,
    @Query('locale') locale: string | undefined,
    @Req() req: Request & { user?: AuthenticatedUser },
  ) {
    return this.usersService.getPublicProfile(id, locale, req.user?.locale);
  }
}
