import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { RfqsService } from './rfqs.service';

@Controller('rfqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RfqsController {
  constructor(private readonly rfqsService: RfqsService) {}

  @Post()
  @Roles('buyer', 'admin')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRfqDto) {
    return this.rfqsService.create(user, dto);
  }

  @Get('mine')
  @Roles('buyer', 'admin')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.listMine(user);
  }

  @Get('inbox')
  @Roles('farmer', 'admin')
  listInbox(@CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.listInbox(user);
  }

  @Get(':id')
  @Roles('buyer', 'farmer', 'admin')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rfqsService.getById(user, id);
  }

  @Post(':id/offer')
  @Roles('farmer', 'admin')
  createOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.rfqsService.createOffer(user, id, dto);
  }

  @Post(':id/accept')
  @Roles('buyer', 'admin')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rfqsService.accept(user, id);
  }

  @Post(':id/decline')
  @Roles('buyer', 'farmer', 'admin')
  decline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rfqsService.decline(user, id);
  }

  @Post(':id/cancel')
  @Roles('buyer', 'admin')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rfqsService.cancel(user, id);
  }
}
