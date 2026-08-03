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
import { FARM_DOCUMENT_MAX_BYTES } from '@agrobridge/shared';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.farmsService.getMine(user);
  }

  @Get('me/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  listMyDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.farmsService.listMyDocuments(user);
  }

  @Post('me/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: FARM_DOCUMENT_MAX_BYTES },
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body('title') title: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.farmsService.uploadDocument(user, title ?? '', file);
  }

  @Delete('me/documents/:documentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.farmsService.removeDocument(user, documentId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.farmsService.getById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFarmDto) {
    return this.farmsService.create(user, dto);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('farmer', 'admin')
  updateMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateFarmDto) {
    return this.farmsService.updateMine(user, dto);
  }
}
