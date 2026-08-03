import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { isLocale, isUserRole } from '@agrobridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-only-change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub || !isUserRole(payload.role) || !isLocale(payload.locale)) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        sellerType: true,
        buyerType: true,
        locale: true,
        displayName: true,
        emailVerifiedAt: true,
        blockedAt: true,
        blockedReason: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.blockedAt) {
      throw new UnauthorizedException(
        user.blockedReason?.trim() || 'This account has been blocked',
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sellerType: user.sellerType,
      buyerType: user.buyerType,
      locale: user.locale,
      displayName: user.displayName,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
}
