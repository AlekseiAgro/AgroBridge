import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ClientIp } from '../http/client-ip';
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
  SetSellerTypeDto,
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
  sendEmailCode(@CurrentUser() user: AuthenticatedUser, @ClientIp() ip: string) {
    return this.verificationService.sendEmailCode(user, ip);
  }

  @Post('email/confirm')
  confirmEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmCodeDto,
    @ClientIp() ip: string,
  ) {
    return this.verificationService.confirmEmailCode(user, dto.code, ip);
  }

  @Post('phone/send-code')
  @UseGuards(EmailVerifiedGuard)
  sendSmsCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendSmsCodeDto,
    @ClientIp() ip: string,
  ) {
    return this.verificationService.sendSmsCode(user, dto.phone, ip);
  }

  @Post('phone/confirm')
  @UseGuards(EmailVerifiedGuard)
  confirmSms(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmCodeDto,
    @ClientIp() ip: string,
  ) {
    return this.verificationService.confirmSmsCode(user, dto.code, ip);
  }

  @Post('seller-type')
  @UseGuards(EmailVerifiedGuard)
  setSellerType(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetSellerTypeDto,
  ) {
    return this.verificationService.setSellerType(user, dto.sellerType);
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
