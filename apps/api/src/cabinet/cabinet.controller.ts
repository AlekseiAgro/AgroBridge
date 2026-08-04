import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { USER_AVATAR_MAX_BYTES } from '@agrobridge/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CabinetService } from './cabinet.service';
import {
  ConfirmEmailChangeDto,
  RequestEmailChangeDto,
} from './dto/change-email.dto';
import {
  ConfirmAccountDeletionDto,
  RequestAccountDeletionDto,
} from './dto/delete-account.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('cabinet')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class CabinetController {
  constructor(private readonly cabinetService: CabinetService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.cabinetService.overview(user);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.cabinetService.updateProfile(user, dto.displayName);
  }

  @Patch('me/locale')
  updateLocale(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateLocaleDto) {
    return this.cabinetService.updateLocale(user, dto.locale);
  }

  @Post('me/email/request')
  requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.cabinetService.requestEmailChange(user, dto.password, dto.newEmail);
  }

  @Post('me/email/confirm')
  confirmEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmEmailChangeDto,
  ) {
    return this.cabinetService.confirmEmailChange(user, dto.password, dto.code);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: USER_AVATAR_MAX_BYTES },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.cabinetService.uploadAvatar(user, file);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.cabinetService.removeAvatar(user);
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
