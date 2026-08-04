import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import {
  BlockUserDto,
  RejectProductDto,
  ReviewNoteDto,
  UpdateCategoryDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Get('products')
  listProducts(@Query('status') status?: string) {
    return this.adminService.listProducts(status);
  }

  @Post('products/:id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.adminService.approve(user, id);
  }

  @Post('products/:id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
  ) {
    return this.adminService.reject(user, id, dto);
  }

  @Get('users')
  listUsers(
    @Query('role') role?: string,
    @Query('blocked') blocked?: string,
    @Query('q') q?: string,
    @Query('registeredWithin') registeredWithin?: string,
    @Query('registeredOn') registeredOn?: string,
  ) {
    return this.adminService.listUsers({
      role,
      blocked,
      q,
      registeredWithin,
      registeredOn,
    });
  }

  @Post('users/:id/block')
  blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.adminService.blockUser(user, id, dto);
  }

  @Post('users/:id/unblock')
  unblockUser(@Param('id') id: string) {
    return this.adminService.unblockUser(id);
  }

  @Get('farms')
  listFarms(@Query('status') status?: string) {
    return this.adminService.listFarms(status);
  }

  @Post('farms/:id/approve')
  approveFarm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewNoteDto,
  ) {
    return this.adminService.verifyFarm(user, id, true, dto);
  }

  @Post('farms/:id/reject')
  rejectFarm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewNoteDto,
  ) {
    return this.adminService.verifyFarm(user, id, false, dto);
  }

  @Post('documents/:id/approve')
  approveDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewNoteDto,
  ) {
    return this.adminService.reviewDocument(user, id, true, dto);
  }

  @Post('documents/:id/reject')
  rejectDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewNoteDto,
  ) {
    return this.adminService.reviewDocument(user, id, false, dto);
  }

  @Get('purchase-requests')
  listPurchaseRequests(@Query('status') status?: string) {
    return this.adminService.listPurchaseRequests(status);
  }

  @Post('purchase-requests/:id/cancel')
  cancelPurchaseRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewNoteDto,
  ) {
    return this.adminService.cancelPurchaseRequest(user, id, dto);
  }

  @Get('deals')
  listDeals(@Query('status') status?: string) {
    return this.adminService.listDeals(status);
  }

  @Get('categories')
  listCategories() {
    return this.adminService.listCategories();
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(id, dto);
  }
}
