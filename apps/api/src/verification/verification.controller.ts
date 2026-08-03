import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CompanyRegistryDto,
  ConfirmCodeDto,
  SendSmsCodeDto,
} from './dto/verification.dto';
import { VerificationService } from './verification.service';

@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('farmer', 'buyer', 'admin')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('me')
  @UseGuards(EmailVerifiedGuard)
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.getStatus(user);
  }

  @Post('email/send-code')
  sendEmailCode(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.sendEmailCode(user);
  }

  @Post('email/confirm')
  confirmEmail(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmCodeDto) {
    return this.verificationService.confirmEmailCode(user, dto.code);
  }

  @Post('phone/send-code')
  @UseGuards(EmailVerifiedGuard)
  sendSmsCode(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendSmsCodeDto) {
    return this.verificationService.sendSmsCode(user, dto.phone);
  }

  @Post('phone/confirm')
  @UseGuards(EmailVerifiedGuard)
  confirmSms(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmCodeDto) {
    return this.verificationService.confirmSmsCode(user, dto.code);
  }

  @Post('company/registry')
  @UseGuards(EmailVerifiedGuard)
  companyRegistry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompanyRegistryDto,
  ) {
    return this.verificationService.checkCompanyRegistry(user, dto.registrationNumber);
  }

  @Post('private/submit')
  @UseGuards(EmailVerifiedGuard)
  submitPrivate(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.submitPrivateFarmerReview(user);
  }
}
