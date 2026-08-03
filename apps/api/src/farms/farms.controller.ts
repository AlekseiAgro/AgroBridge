import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FARM_DOCUMENT_MAX_BYTES, FARM_PHOTO_MAX_BYTES } from '@agrobridge/shared';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { FarmsService } from './farms.service';

@Controller('farms')
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get()
  list() {
    return this.farmsService.list();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.farmsService.getMine(user);
  }

  @Get('me/documents')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  listMyDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.farmsService.listMyDocuments(user);
  }

  @Post('me/documents')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: FARM_DOCUMENT_MAX_BYTES },
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body('title') title: string,
    @Body('kind') kind: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.farmsService.uploadDocument(user, title ?? '', file, kind);
  }

  @Delete('me/documents/:documentId')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.farmsService.removeDocument(user, documentId);
  }

  @Post('me/photos')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: FARM_PHOTO_MAX_BYTES },
    }),
  )
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.farmsService.uploadPhoto(user, file);
  }

  @Delete('me/photos/:photoId')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  removePhoto(@CurrentUser() user: AuthenticatedUser, @Param('photoId') photoId: string) {
    return this.farmsService.removePhoto(user, photoId);
  }

  @Patch('me/photos/:photoId/primary')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  setPrimaryPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('photoId') photoId: string,
  ) {
    return this.farmsService.setPrimaryPhoto(user, photoId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.farmsService.getById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFarmDto) {
    return this.farmsService.create(user, dto);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
  @Roles('farmer', 'buyer', 'admin')
  updateMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFarmDto) {
    return this.farmsService.updateMine(user, dto);
  }
}
