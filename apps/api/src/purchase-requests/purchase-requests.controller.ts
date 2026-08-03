import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreatePurchaseQuoteDto } from './dto/create-purchase-quote.dto';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { PurchaseRequestsService } from './purchase-requests.service';

@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly purchaseRequestsService: PurchaseRequestsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  listOpen(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query('category') category?: string,
    @Query('q') q?: string,
  ) {
    return this.purchaseRequestsService.listOpen({ category, q }, user ?? null);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.purchaseRequestsService.listMine(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePurchaseRequestDto) {
    return this.purchaseRequestsService.create(user, dto);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  getById(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.purchaseRequestsService.getById(user ?? null, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseRequestsService.cancel(user, id);
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseRequestsService.close(user, id);
  }

  @Post(':id/quotes')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  createQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreatePurchaseQuoteDto,
  ) {
    return this.purchaseRequestsService.createQuote(user, id, dto);
  }

  @Post(':id/quotes/:quoteId/accept')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  acceptQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.purchaseRequestsService.acceptQuote(user, id, quoteId);
  }

  @Post(':id/quotes/:quoteId/decline')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  declineQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.purchaseRequestsService.declineQuote(user, id, quoteId);
  }

  @Post(':id/quotes/:quoteId/withdraw')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  withdrawQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.purchaseRequestsService.withdrawQuote(user, id, quoteId);
  }
}
