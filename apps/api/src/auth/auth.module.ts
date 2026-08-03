import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { VerificationModule } from '../verification/verification.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerifiedGuard } from './email-verified.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-only-change-me',
        signOptions: {
          // 7 days in seconds; override via JWT_EXPIRES_SECONDS
          expiresIn: Number(config.get<string>('JWT_EXPIRES_SECONDS') ?? 60 * 60 * 24 * 7),
        },
      }),
    }),
    VerificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailVerifiedGuard],
  exports: [AuthService, JwtModule, PassportModule, EmailVerifiedGuard],
})
export class AuthModule {}
