import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ClientIp } from '../http/client-ip';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @ClientIp() ip: string) {
    return this.authService.register(dto, ip);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @ClientIp() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto, @ClientIp() ip: string) {
    return this.passwordReset.requestReset(dto, ip);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto, @ClientIp() ip: string) {
    return this.passwordReset.resetPassword(dto, ip);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @ClientIp() ip: string,
  ) {
    return this.authService.changePassword(user.id, dto, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
